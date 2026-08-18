import { expect, test } from '@playwright/test'
import { ROUTES } from './app-routes'

/**
 * 화면 전체 문구 검사 — AGENTS.md §2.4, docs/14 §4, references/README §2
 * 단어 하나가 아니라 "확정 표현"과 "기본값 오표기"만 잡습니다.
 */
const FORBIDDEN = [
  /평균 자세 점수/,
  /목 건강 점수/,
  /거북목으로 진단/,
  /거북목 확률/,
  /정상 자세가 아닙니다/,
  /통증을 예방합니다/,
  /치료가 필요합니다/,
  /CVA\s*(점수|지수|각도)/,
  /AI가\s*집중/,
  /집중도를?\s*(측정|판정|분석)/,
  // 레퍼런스의 30분 기본값이 화면에 남아 있으면 안 됩니다.
  /30분\s*집중/,
]

/**
 * 사용자 화면에는 개발 일정·구현 단계를 노출하지 않습니다.
 * QA Lab(/lab) 내부는 개발 도구이므로 예외입니다.
 */
const INTERNAL = [
  // 내부 코드명 — 사용자 화면에는 모드별 공식 괴물 이름만 씁니다.
  /마감괴수/,
  /Phase\s*\d/i,
  /개발용/,
  /QA Lab · 상태 주입/,
  /getUserMedia/,
  /MediaPipe/,
  /Supabase/,
  /Dexie/,
  /IndexedDB/,
]

for (const path of ROUTES) {
  test(`${path} — 금지 문구가 없다`, async ({ page }) => {
    await page.goto(path)
    const text = await page.locator('body').innerText()

    for (const pattern of FORBIDDEN) {
      expect(text, `${path} 에서 ${pattern} 발견`).not.toMatch(pattern)
    }

    if (path !== '/lab') {
      for (const pattern of INTERNAL) {
        expect(text, `${path} 에서 내부 개발 문구 ${pattern} 발견`).not.toMatch(
          pattern,
        )
      }
    }
  })
}

test('서비스명과 기본 세션이 올바르다', async ({ page }) => {
  await page.goto('/?demo=1')
  const text = await page.locator('body').innerText()

  expect(text).toContain('Deskfit')
  expect(text).toContain('25분 집중')
  expect(text).toContain('회복 휴식')
})

test('영상 미저장·미전송 안내가 있다', async ({ page }) => {
  await page.goto('/?demo=1')
  await expect(
    page.getByText('모든 영상은 기기 안에서만 분석되고 저장되지 않아요.'),
  ).toBeVisible()

  await page.goto('/camera')
  const camera = await page.locator('body').innerText()
  expect(camera).toContain('영상 저장 없음')
  expect(camera).toContain('영상은 저장하지도, 외부로 보내지도 않아요.')
})

test('의료 진단이 아니라는 안내가 있다', async ({ page }) => {
  await page.goto('/camera')
  const text = await page.locator('body').innerText()

  expect(text).toContain('의료 진단 아님')
  expect(text).toContain('이 서비스는 의료 진단이나 치료를 제공하지 않아요')
})

test('결과 화면은 자세 점수 대신 회복·감지 가능 시간을 보여준다', async ({ page }) => {
  await page.goto('/result/demo?demo=1')
  const text = await page.locator('body').innerText()

  expect(text).toContain('감지 가능 시간')
  expect(text).toContain('회복 성공 / 회복 기회')
  expect(text).not.toMatch(/자세 점수/)
  expect(text).not.toMatch(/\d+\s*점/)
})
