import { expect, test } from '@playwright/test'

test('디버그 캘리브레이션에서 MoveNet/WASM 진단을 직접 실행할 수 있다', async ({
  page,
}) => {
  await page.goto('/calibration?postureDebug=1')

  const button = page.getByRole('button', { name: 'MoveNet/WASM 10프레임 측정' })
  await expect(button).toBeEnabled({ timeout: 20_000 })

  await button.click()
  await expect(
    page.getByText(/WASM · 로드 .* 중앙 추론 .* 약 .*fps · 감지 \d+\/10/),
  ).toBeVisible({ timeout: 60_000 })
})
