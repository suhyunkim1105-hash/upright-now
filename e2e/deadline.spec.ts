import { expect, test, type Page } from '@playwright/test'
import { dev } from './dev-api'

/**
 * 마감순경 삐약 (V1.1) — 알림 1회, 미루기, 완료, 미니 위젯 동기화.
 * setDeadlineIn(초) dev api 로 시계를 기다리지 않고 단계를 만듭니다.
 */
test.use({ viewport: { width: 1440, height: 1000 } })

async function forceUnsupportedPip(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'documentPictureInPicture', {
      value: undefined,
      configurable: true,
    })
  })
}

async function startDemoSession(page: Page) {
  await page.goto('/session/demo?demo=1')
  await dev(page, 'startSession', 'demo')
  await page.waitForTimeout(300)
}

test('마감 없음 → 알림 패널이 나타나지 않는다', async ({ page }) => {
  await startDemoSession(page)
  await page.waitForTimeout(2500)
  await expect(page.getByTestId('deadline-alert-panel')).toHaveCount(0)
})

test('1분 전 알림 1회 → 5분 미루기 → 초과 알림 → 완료 celebrate', async ({ page }) => {
  await startDemoSession(page)

  // 남은 55초 → t1 urgent
  await dev(page, 'setDeadlineIn', 55)
  const panel = page.getByTestId('deadline-alert-panel').first()
  await expect(panel).toBeVisible({ timeout: 5000 })
  await expect(panel).toContainText('1분 남았어요')
  await expect(panel).toContainText('마감순경 삐약')

  // 5분 미루기 → 패널 닫힘, 보상 무변화(XP 표시 그대로)
  await panel.getByRole('button', { name: '5분 미루기', exact: true }).click()
  await expect(page.getByTestId('deadline-alert-panel')).toHaveCount(0)

  // 마감 초과 → overdue 1회
  await dev(page, 'setDeadlineIn', -5)
  const overdue = page.getByTestId('deadline-alert-panel').first()
  await expect(overdue).toBeVisible({ timeout: 5000 })
  await expect(overdue).toContainText('시간이 지났어요')

  // 완료 → celebrate 후 추가 알림 없음
  await overdue.getByRole('button', { name: '완료' }).click()
  await expect(page.getByTestId('deadline-alert-panel')).toContainText(
    '완료했어요! 오늘의 마감을 지켜냈어요.',
  )
  // 완료 후 같은 마감으로는 알림이 다시 나오지 않는다 (completed 유지)
  await page.waitForTimeout(2000)
  await expect(page.getByTestId('deadline-alert-panel')).toContainText('완료했어요')
})

test('PIP 미지원 → 화면 안 미니 위젯에도 같은 알림이 뜬다', async ({ page }) => {
  await forceUnsupportedPip(page)

  // 토글 ON (실사용자)
  await page.goto('/settings')
  const toggleCard = page
    .locator('section', { hasText: '세션 시작 시 미니 위젯 자동 열기' })
    .last()
  await toggleCard.getByRole('button', { name: '꺼짐' }).click()

  await page.goto('/session/setup?demo=1')
  await page.getByRole('button', { name: /집중 시작|데모 시작/ }).click()
  await expect(page.getByTestId('mini-posture-widget')).toBeVisible()

  await dev(page, 'setDeadlineIn', 50)
  // 미니 위젯 안 패널과 메인 화면 패널이 같은 store 로 동기화
  await expect(
    page.getByTestId('mini-posture-widget').getByTestId('deadline-alert-panel'),
  ).toBeVisible({ timeout: 5000 })
  await expect(
    page.getByTestId('mini-posture-widget').getByTestId('deadline-alert-panel'),
  ).toContainText('1분 남았어요')
})

test('이번 세션에서 끄기 → 이후 알림 없음, 세션은 계속', async ({ page }) => {
  await startDemoSession(page)
  await dev(page, 'setDeadlineIn', 50)

  const panel = page.getByTestId('deadline-alert-panel').first()
  await expect(panel).toBeVisible({ timeout: 5000 })
  await panel.getByRole('button', { name: '이번 세션에서 끄기' }).click()
  await expect(page.getByTestId('deadline-alert-panel')).toHaveCount(0)

  await page.waitForTimeout(2000)
  await expect(page.getByTestId('deadline-alert-panel')).toHaveCount(0)
  // 세션 타이머는 계속
  await expect(page.getByText('남은 시간')).toBeVisible()
})
