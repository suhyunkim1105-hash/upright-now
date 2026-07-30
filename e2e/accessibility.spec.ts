import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const STABLE_DEMO_ROUTES = [
  { name: '첫 방문 홈', path: '/' },
  { name: '3분 집중 데모', path: '/session/demo?demo=1' },
] as const

function violationSummary(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(' ')).join(', ')
      return `${violation.id}: ${violation.help} (${targets})`
    })
    .join('\n')
}

for (const route of STABLE_DEMO_ROUTES) {
  test(`${route.name} — WCAG A/AA 핵심 UI에 axe 위반이 없다`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 768 })
    await page.goto(route.path)
    await expect(page.locator('#root')).not.toBeEmpty()

    const results = await new AxeBuilder({ page })
      .include('#root')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(results.violations, violationSummary(results.violations)).toEqual([])
  })
}
