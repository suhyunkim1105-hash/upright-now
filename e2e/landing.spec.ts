import { expect, test } from '@playwright/test'

test.describe('랜딩 페이지', () => {
  test.use({ viewport: { width: 1280, height: 768 } })

  test('첫 화면과 스크롤 흐름이 데스크톱에서 읽힌다', async ({ page }) => {
    await page.goto('/landing')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PC 앞 집중을가벼운 자세로')
    await expect(page.getByRole('button', { name: /내 기준 만들기/ }).first()).toBeVisible()
    await expect(page.getByTestId('landing-hero-3d')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    await page.waitForTimeout(1_100)
    await page.screenshot({ path: 'test-results/landing-top-1280.png' })

    await page.getByRole('link', { name: '어떻게 쓰는지 보기' }).click()
    await expect(page.getByRole('heading', { name: /네 번의 자연스러운 흐름으로/ })).toBeInViewport()
    await expect(page.locator('.landing-routine__steps .landing-reveal--visible').first()).toBeVisible()
    const revealDuration = await page.locator('.landing-routine__steps .landing-reveal').first().evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration))
    expect(revealDuration).toBeGreaterThanOrEqual(1.2)
    await page.waitForTimeout(1_900)
    await page.screenshot({ path: 'test-results/landing-routine-1280.png' })

    await page.locator('#trust').scrollIntoViewIfNeeded()
    await expect(page.getByRole('heading', { name: /원본 영상과 스냅샷은/ })).toBeInViewport()
    await expect(page.locator('.landing-trust__diagram')).toBeVisible()
    await page.waitForTimeout(1_600)
    await page.screenshot({ path: 'test-results/landing-trust-1280.png' })
  })

  test('작은 화면에서도 제목과 3D 장면이 잘리지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/landing')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PC 앞 집중을가벼운 자세로')
    await expect(page.getByTestId('landing-hero-3d')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  })
})
