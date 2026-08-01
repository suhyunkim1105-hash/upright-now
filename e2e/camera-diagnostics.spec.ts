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

test('calibration stream is reused by the session route', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const mediaDevices = navigator.mediaDevices
    const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices)
    Object.defineProperty(window, 'cameraCallCount', { value: 0, writable: true })
    mediaDevices.getUserMedia = async (constraints) => {
      ;(window as unknown as { cameraCallCount: number }).cameraCallCount += 1
      return originalGetUserMedia(constraints)
    }
  })

  await page.goto('/calibration?return=%2Fsession%2Fhandoff')
  await expect(page.getByTestId('calibration-guide')).toBeVisible()
  await page.waitForFunction(() => document.querySelector('video')?.srcObject !== null)

  await page.evaluate(() => window.__upright?.injectTestCalibration())
  await page.evaluate(() => window.__upright?.startSession('handoff'))
  await page.evaluate(() => {
    window.history.pushState({}, '', '/session/handoff')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  await expect(page.getByTestId('session-camera-panel')).toBeVisible()
  await expect(page.getByTestId('session-camera-panel-video')).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { cameraCallCount: number }).cameraCallCount))
    .toBe(1)
})
