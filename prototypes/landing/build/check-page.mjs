/* 랜딩 검증 — 콘솔 에러 수집 + 구간별 스크린샷 */
import { createRequire } from 'node:module';
const require_ = createRequire('C:/Users/user/Desktop/girin_mvp/upright-now/package.json');
const { chromium } = require_('playwright');
import { mkdirSync } from 'node:fs';

const OUT = 'C:/Users/user/Desktop/girin_mvp/prototypes/landing/build/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGE: ' + e.message));

await page.goto('file:///C:/Users/user/Desktop/girin_mvp/prototypes/landing/index.html');
await page.waitForTimeout(4500);   /* 로더 열릴 때까지 */

/* 페이지 전체 높이와 구간 스크린샷 */
const total = await page.evaluate(() => document.body.scrollHeight);
console.log('페이지 높이', total, 'px =', (total / 900).toFixed(1), '화면');

const stops = [
  ['hero', 0],
  ['portal-mid', 0.055], ['portal-full', 0.095],
  ['world-1', 0.14], ['world-2', 0.19], ['world-3', 0.24], ['world-4', 0.30],
  ['intro', 0.37], ['mani-mid', 0.45], ['mani-end', 0.50],
  ['space-1', 0.55], ['space-3', 0.62],
  ['story', 0.68], ['rhythm', 0.74], ['caps', 0.78],
  ['deck', 0.83], ['faq', 0.87], ['voices', 0.91], ['journal', 0.94],
  ['contact', 0.97], ['footer', 1],
];
for (const [name, f] of stops) {
  await page.evaluate(y => scrollTo(0, y), Math.min(total - 900, Math.round(total * f)));
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
console.log('콘솔 에러', errors.length);
errors.slice(0, 12).forEach(e => console.log(' -', e.slice(0, 200)));
await browser.close();
