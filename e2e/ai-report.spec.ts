import { expect, test } from '@playwright/test'
import { dev } from './dev-api'

test('완료한 세션에서 동의 후 AI 회고를 만든다', async ({ page }) => {
  await page.goto('/session/demo?demo=1')
  await dev(page, 'startSession', 'ai-report-e2e')
  await dev(page, 'startRecovery')
  await dev(page, 'recoverySuccess')
  await dev(page, 'completeSession')
  await page.getByRole('button', { name: '결과 보기' }).click()

  const card = page.locator('section', {
    has: page.getByRole('heading', { name: 'AI 세션 회고' }),
  })
  await expect(card).toBeVisible()
  await card.getByRole('checkbox').check()
  await card.getByRole('button', { name: 'AI 회고 만들기' }).click()

  await expect(card.getByText('이번 흐름을 짧게 정리했어요.')).toBeVisible()
  await expect(card.getByText('다음 2분')).toBeVisible()
})
