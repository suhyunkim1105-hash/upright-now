import { expect, test } from '@playwright/test'

test('기존 Zarafa 랜딩은 /landing 경로에서 복구된다', async ({ page }) => {
  await page.goto('/landing#how-it-works')

  await expect(page).toHaveURL(/\/landing#how-it-works$/)
  await expect(page.locator('iframe[title="Zarafa 랜딩"]')).toBeVisible()

  const zarafa = page.frameLocator('iframe[title="Zarafa 랜딩"]')
  await expect(zarafa.getByRole('heading', { level: 1 })).toContainText('PC 앞 집중을')
  await expect(zarafa.locator('#how-it-works')).toBeAttached()
})

test('Upright Now 랜딩은 /upright-now 경로에서 독립적으로 열린다', async ({ page }) => {
  await page.goto('/upright-now')

  await expect(page.locator('.landing-hero__visual')).toBeVisible()
  await expect(page.locator('.landing-hero-3d')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('PC 앞 집중을')
})

test('Zarafa 랜딩의 모션 토큰은 Upright Now의 느린 리빌 템포를 사용한다', async ({ page }) => {
  await page.goto('/landing')

  const zarafa = page.frameLocator('iframe[title="Zarafa 랜딩"]')
  const revealDuration = await zarafa.locator('.landing-reveal > .landing-kicker').first().evaluate((element) => getComputedStyle(element).transitionDuration)
  const buttonDuration = await zarafa.locator('.landing-button').first().evaluate((element) => getComputedStyle(element).transitionDuration)

  expect(revealDuration).toContain('1.12s')
  expect(revealDuration).toContain('1.25s')
  expect(buttonDuration).toContain('0.6s')
  expect(buttonDuration).toContain('0.19s')
})
