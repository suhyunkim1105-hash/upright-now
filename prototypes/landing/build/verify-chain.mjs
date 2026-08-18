/* 체인 스크럽 검증 — 좌표가 맞으면 구간마다 시간이 0→1 로 흐릅니다 */
import { createRequire } from 'node:module';
const require_ = createRequire('C:/Users/user/Desktop/girin_mvp/upright-now/package.json');
const { chromium } = require_('playwright');
import { mkdirSync } from 'node:fs';
const OUT = 'C:/Users/user/Desktop/girin_mvp/prototypes/landing/build/audit';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto('file:///C:/Users/user/Desktop/girin_mvp/prototypes/landing/index.html');
await page.waitForTimeout(4500);

const info = await page.evaluate(() => {
  const t = document.getElementById('worldTrack');
  return { base: Math.round(t.getBoundingClientRect().top + scrollY), h: t.offsetHeight, vh: innerHeight };
});
console.log('트랙 기준점', info.base, '높이', info.h);

/* 체인을 0.25 화면 간격으로 훑으며 각 장면의 재생 위치와 보이는 카피를 봅니다 */
const rows = [];
for (let k = 0; k <= info.h / info.vh; k += 0.5) {
  await page.evaluate(y => scrollTo(0, y), info.base + k * info.vh);
  await page.waitForTimeout(420);
  const r = await page.evaluate(() => {
    const vids = [...document.querySelectorAll('.w-scene video')];
    const cur = vids.map(v => v.duration ? +(v.currentTime / v.duration).toFixed(2) : -1);
    const vis = [...document.querySelectorAll('.w-scene')].findIndex(s => +getComputedStyle(s).opacity > .5);
    const copy = [...document.querySelectorAll('.w-copy')]
      .map((c, i) => +getComputedStyle(c).opacity > .35 ? i : -1).filter(i => i >= 0);
    return { cur, vis, copy };
  });
  rows.push({ k, ...r });
}
console.log('구간별 (진행도 배열 / 보이는 장면 / 보이는 카피)');
rows.forEach(r => console.log(' ', r.k.toFixed(1), JSON.stringify(r.cur), 'scene', r.vis, 'copy', JSON.stringify(r.copy)));

/* 카피가 실제로 렌더되는 지점 스크린샷 */
for (const [name, k] of [['fix-d1', 0.7], ['fix-c1', 1.75], ['fix-d2', 2.8], ['fix-d4', 7.0], ['fix-cta', 7.6]]) {
  await page.evaluate(y => scrollTo(0, y), info.base + k * info.vh);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
await browser.close();
