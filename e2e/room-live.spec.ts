import { expect, test, type Page, type Request } from '@playwright/test'

/**
 * 실제 2인 친구 방 라이브 테스트 — 두 개의 독립 브라우저 컨텍스트(별도 저장소 =
 * 별도 익명 사용자)로 방 생성→입장→준비→시작→공동 보스→기린 싱크를 검증합니다.
 *
 * Supabase env 가 없으면 자동으로 건너뜁니다.
 * 실행: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_ENABLE_FRIEND_ROOM=true
 *       를 .env.local 에 넣고 `npx playwright test e2e/room-live.spec.ts`
 */
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const HAS_ENV = Boolean(SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)

/** Supabase 로 나가는 요청 본문에 금지 데이터가 없는지 감시합니다. */
const FORBIDDEN_PATTERN =
  /landmark|frame|snapshot|faceImage|coordinates|"bad"|badDuration|postureState|baseline|variance/i

function watchForbidden(page: Page, offenders: string[]): void {
  page.on('request', (request: Request) => {
    if (!SUPABASE_URL || !request.url().startsWith(SUPABASE_URL)) return
    const body = request.postData()
    if (body && FORBIDDEN_PATTERN.test(body)) {
      offenders.push(`${request.url()} :: ${body.slice(0, 200)}`)
    }
  })
  // 진단용 — RPC 실패 원인을 표준 출력으로 남깁니다.
  page.on('response', (response) => {
    if (!SUPABASE_URL || !response.url().includes('apply_room_damage')) return
    void response.text().then((text) => {
      console.log(`[rpc] apply_room_damage ${response.status()} :: ${text.slice(0, 300)}`)
    })
  })
}

test.describe('실제 2인 친구 방', () => {
  test.skip(!HAS_ENV, 'Supabase env 미설정 — .env.local 에 URL/ANON_KEY 필요')
  test.setTimeout(180_000)

  test('생성→입장→준비→시작→공동 보스→회복→기린 싱크→금지 데이터 0건', async ({
    browser,
  }) => {
    const offenders: string[] = []

    // 사용자 A (방장) — 일반 창에 해당하는 컨텍스트
    const contextA = await browser.newContext()
    const pageA = await contextA.newPage()
    watchForbidden(pageA, offenders)

    // 사용자 B (게스트) — 시크릿 창에 해당하는 독립 컨텍스트
    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()
    watchForbidden(pageB, offenders)

    const inject = (page: Page) =>
      page.evaluate(() => {
        ;(window as unknown as { __upright?: { injectTestCalibration(): void } })
          .__upright?.injectTestCalibration()
      })

    // A: 방 생성 (자세 기준·카메라 준비를 e2e 용으로 주입)
    await pageA.goto('/room/new')
    await inject(pageA)
    await pageA.getByLabel('방 이름').fill('통합 테스트')
    await pageA.getByLabel('과목 또는 과제').fill('e2e')
    await pageA.getByRole('button', { name: '방 만들기' }).click()
    await expect(pageA.getByText(/[A-Z0-9]{6}/)).toBeVisible({ timeout: 20_000 })
    const code = (await pageA
      .locator('.tracking-\\[0\\.3em\\]')
      .textContent())!.trim()
    expect(code).toMatch(/^[A-Z0-9]{6}$/)

    // B: 코드로 입장 (링크·코드 진입만으로 세션이 시작되지 않아야 함)
    await pageB.goto('/room/new')
    await inject(pageB)
    await pageB.getByLabel('방 코드').fill(code)
    await pageB.getByRole('button', { name: '입장' }).click()
    await expect(pageB.getByText('참가자')).toBeVisible({ timeout: 20_000 })

    // 양쪽에 참가자 2명 / 정원 10명 표시
    await expect(pageA.getByText('2 / 10')).toBeVisible({ timeout: 20_000 })
    await expect(pageB.getByText('2 / 10')).toBeVisible({ timeout: 20_000 })

    // 준비 게이트: 한 명만 준비된 동안 방장 버튼은 '모두 준비되면 시작' + 비활성
    await pageA.getByRole('button', { name: '준비 완료' }).click()
    await expect(
      pageA.getByRole('button', { name: '모두 준비되면 시작' }),
    ).toBeDisabled()

    await pageB.getByRole('button', { name: '준비 완료' }).click()

    const startButton = pageA.getByRole('button', { name: '세션 시작' })

    // 방장만 시작 버튼 노출 → 둘 다 준비되면 활성화
    await expect(pageB.getByRole('button', { name: '세션 시작' })).toHaveCount(0)
    await expect(startButton).toBeEnabled({ timeout: 20_000 })
    await startButton.click()

    // 두 사람 모두 개인 세션 화면으로 이동 (각자 기기에서 독립 분석)
    await expect(pageA.getByText('남은 시간')).toBeVisible({ timeout: 20_000 })
    await expect(pageB.getByText('남은 시간')).toBeVisible({ timeout: 20_000 })

    // 연결 끊김 → 개인 세션은 계속 (재연결은 이후 흐름이 증명)
    await contextB.setOffline(true)
    await pageB.waitForTimeout(1500)
    await expect(pageB.getByText('남은 시간')).toBeVisible()
    await contextB.setOffline(false)
    await pageB.waitForTimeout(2500)

    // 공동 보스 초기 HP 2000 동기화
    const bossA = pageA.getByRole('progressbar', { name: /꼬몽이/ })
    await expect(bossA).toHaveAttribute('value', '100')

    // 친구 회복 알림·기린 싱크는 모두 잠깐 뜨는 토스트라서,
    // 회복을 실행하기 "전에" 세 화면 감시를 먼저 걸어 두고 동시에 기다립니다.
    const toastWatch = Promise.all([
      expect(pageB.getByText(/회복 에너지를 보냈어요/)).toBeVisible({
        timeout: 30_000,
      }),
      expect(pageA.getByText(/기린 싱크/)).toBeVisible({ timeout: 30_000 }),
      expect(pageB.getByText(/기린 싱크/)).toBeVisible({ timeout: 30_000 }),
    ])

    // A 회복 성공 → 공동 보스 -40, 곧바로 B 도 회복 —
    // 10초 기린 싱크 윈도 안에 확실히 들어가도록 연달아 실행합니다.
    await pageA.evaluate(() => {
      ;(window as unknown as { __upright?: { startRecovery(): void; recoverySuccess(): void } })
        .__upright?.startRecovery()
      ;(window as unknown as { __upright?: { recoverySuccess(): void } })
        .__upright?.recoverySuccess()
    })
    await pageB.evaluate(() => {
      ;(window as unknown as { __upright?: { startRecovery(): void; recoverySuccess(): void } })
        .__upright?.startRecovery()
      ;(window as unknown as { __upright?: { recoverySuccess(): void } })
        .__upright?.recoverySuccess()
    })

    await toastWatch
    // 두 회복(-80) + 싱크(-60) = 1860 → 93% — 양쪽 HP 동기화 검증
    const bossB = pageB.getByRole('progressbar', { name: /꼬몽이/ })
    await expect(bossA).toHaveAttribute('value', '93', { timeout: 20_000 })
    await expect(bossB).toHaveAttribute('value', '93', { timeout: 20_000 })

    // 협동 화면: 공동 괴물 이름이 양쪽에 표시
    await expect(pageA.getByText('팀플 괴물 꼬몽이').first()).toBeVisible()
    await expect(pageB.getByText('팀플 괴물 꼬몽이').first()).toBeVisible()

    // A 가 응원 반응 → B 화면 친구 캐릭터 위에 말풍선이 실제로 뜬다.
    // 말풍선은 수신 후 3초만 표시되므로, 전달이 유실되면 rate limit(5초)
    // 해제 후 한 번 더 눌러 재검증합니다. (실사용자도 다시 누를 수 있음)
    const bubble = pageB.getByTestId('reaction-bubble')
    await pageA.getByRole('button', { name: '조금만 더' }).click()
    try {
      await expect(bubble).toContainText('조금만 더', { timeout: 6_000 })
    } catch {
      await pageA.waitForTimeout(5_100)
      await pageA.getByRole('button', { name: '조금만 더' }).click({ force: true })
      await expect(bubble).toContainText('조금만 더', { timeout: 10_000 })
    }

    // A 스트레칭: 타이머가 0초가 된 뒤 '완료하고 돌아가기'를 눌러야만
    // 보상·공동 방어막 +15 가 적용됩니다. (배속으로 타이머만 빨리 돌림)
    await pageA.evaluate(() => {
      ;(window as unknown as { __upright?: { setTimeScale(s: number): void } })
        .__upright?.setTimeScale(50)
    })
    await pageA.getByRole('button', { name: '잠깐 스트레칭' }).click()
    // 완주 전에는 완료 버튼이 없어야 합니다.
    await expect(
      pageA.getByRole('button', { name: '그만하고 돌아가기' }),
    ).toBeVisible()
    const completeStretch = pageA.getByRole('button', {
      name: '완료하고 돌아가기',
    })
    await expect(completeStretch).toBeVisible({ timeout: 20_000 })
    await completeStretch.click()
    await pageA.evaluate(() => {
      ;(window as unknown as { __upright?: { setTimeScale(s: number): void } })
        .__upright?.setTimeScale(1)
    })
    await expect(pageB.getByText(/방어막 15/)).toBeVisible({ timeout: 20_000 })

    // 카메라 영상·프레임·랜드마크·bad 상태 전송 0건
    expect(offenders).toEqual([])

    await contextA.close()
    await contextB.close()
  })
})
