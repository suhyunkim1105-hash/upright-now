import { expect, test } from '@playwright/test'
import { dev } from './dev-api'

test.use({ viewport: { width: 1440, height: 1000 } })

test('keeps the camera in the session screen instead of opening an in-app floating preview', async ({ page }) => {
  test.skip(process.env.VITE_ENABLE_CAMERA !== 'true', 'camera feature flag is disabled')

  await page.goto('/')
  await dev(page, 'injectTestCalibration')
  await dev(page, 'startSession', 'e2e-camera-panel')
  await page.evaluate(() => {
    window.history.pushState({}, '', '/session/e2e-camera-panel')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  const panel = page.getByTestId('session-camera-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByTestId('session-camera-panel-video')).toBeVisible()
  await expect(page.getByTestId('session-camera-preview')).toHaveCount(0)
})

test('does not create a fallback companion just by starting a session', async ({ page }) => {
  await page.goto('/session/setup?demo=1')
  await page.getByText('3분 데모').click()
  await page.getByRole('button', { name: /집중 시작|데모 시작/ }).click()

  await expect(page.getByTestId('mini-posture-widget')).toHaveCount(0)
})
