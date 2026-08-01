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

  await expect(page.getByTestId('landing-hero-3d')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('PC 앞 집중을')
})
