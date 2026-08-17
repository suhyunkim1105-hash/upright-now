/* 참조 이미지 만들기 — 크레딧 0.
   생성 모델에게 "우리 캠퍼스, 우리 캐릭터" 를 알려 주는 닻입니다.
   실행: cd upright-now && node ../prototypes/landing/build/make-refs.mjs */
/* playwright 는 upright-now/node_modules 에만 있습니다. ESM 은 **스크립트
   위치** 기준으로 찾으므로, 거기서 돌려도 여기서는 못 찾습니다. 경로를
   박아서 가져옵니다. */
import { createRequire } from 'node:module';
const require_ = createRequire('C:/Users/user/Desktop/girin_mvp/upright-now/package.json');
const { chromium } = require_('playwright');
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'C:/Users/user/Desktop/girin_mvp/prototypes/landing/build/refs';
mkdirSync(OUT, { recursive: true });
const URL = 'file:///C:/Users/user/Desktop/girin_mvp/prototypes/openworld/index.html';

/* 각 장면의 참조 — 존과 카메라를 둘 자리 */
const SHOTS = [
  { id: 'dorm',     zone: 'dorm',     x: 4,  y: 5 },
  { id: 'plaza',    zone: 'campus',   x: 21, y: 20 },
  { id: 'library',  zone: 'library',  x: 18, y: 14 },
  { id: 'mainhall', zone: 'mainhall', x: 18, y: 14 },
  { id: 'union',    zone: 'union',    x: 16, y: 10 },
  { id: 'campus',   zone: 'campus',   x: 22, y: 24 },
];

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--allow-file-access-from-files'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera'] });
const page = await ctx.newPage();
await page.addInitScript(() => {
  localStorage.setItem('girin.signup', JSON.stringify({ nick: '지훈', pet: 'giraffe', school: '명지대학교' }));
  localStorage.setItem('girin.tutorial', 'seen');
});
await page.goto(URL);
await page.waitForTimeout(3000);

/* 참조는 **화면 UI 없이** 월드만 보여야 합니다 — HUD 가 섞이면 생성 모델이
   그 사각형들까지 건물로 읽습니다. 낮·맑음으로 고정해 색도 일정하게. */
await page.evaluate(() => {
  TIME.override = 13; WEATHER.override = 0;
  for (const id of ['hud-perf', 'hud-session', 'coin', 'coinNote', 'gear', 'chat', 'prompt', 'headTimer', 'banner'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  document.querySelectorAll('.chat-bubble').forEach((n) => n.remove());
});

for (const s of SHOTS) {
  await page.evaluate(([z, x, y]) => {
    window.__teleport(z, x, y);
    /* 존을 바꾸면 시각·날씨 강제가 풀립니다. 매번 다시 못 박아야 여섯 장의
       빛이 같습니다 — 참조 여섯 장의 색이 제각각이면 생성 모델이 그걸
       "이 세계는 색이 여러 가지" 로 배웁니다. */
    TIME.override = 13; WEATHER.override = 0;
    /* 다른 사람(멀티플레이 봇)은 빼야 합니다. 참조에 남이 서 있으면
       생성된 장면에도 정체불명의 인물이 따라 들어옵니다. */
    if (window.MP && MP.collect) MP.collect = () => {};
    document.querySelectorAll('.chat-bubble').forEach((n) => n.remove());
  }, [s.zone, s.x, s.y]);
  await page.waitForTimeout(1100);
  /* 캔버스만 잘라 냅니다 — 페이지 여백이 들어가면 그것도 배경으로 학습됩니다 */
  const cv = await page.$('#world');
  await cv.screenshot({ path: OUT + '/world-' + s.id + '.png' });
  console.log('참조', s.id, s.zone, s.x + ',' + s.y);
}

/* 캐릭터 8종 — 32x48 시트의 down 프레임을 ×12 최근접 확대.
   생성 모델은 32px 그림을 못 읽습니다. 크게 키워야 비율과 색이 전달됩니다. */
await page.evaluate(async (out) => {
  window.__charRefs = {};
  for (const [name, sp] of Object.entries(CHAR_SPECIES)) {
    const img = CHAR_IMG[sp.slug];
    const c = document.createElement('canvas');
    c.width = 32 * 12; c.height = 48 * 12;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    /* 투명 유지 — 어두운 면 위에 놓일 때 흰 상자가 생기지 않게 */
    g.drawImage(img, 96, 0, 32, 48, 0, 0, c.width, c.height);   // down 프레임
    window.__charRefs[sp.slug] = c.toDataURL('image/png');
  }
  return Object.keys(window.__charRefs);
}, OUT);

const chars = await page.evaluate(() => window.__charRefs);

for (const [slug, dataUrl] of Object.entries(chars)) {
  writeFileSync(OUT + '/char-' + slug + '.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('캐릭터', slug);
}

/* 8종을 한 장에 늘어놓은 시트 — "이 세계의 주민들" 을 한 번에 보여 줍니다 */
const sheet = await page.evaluate(() => {
  const slugs = Object.values(CHAR_SPECIES).map((s) => s.slug);
  const c = document.createElement('canvas');
  c.width = 32 * 6 * slugs.length; c.height = 48 * 6;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  /* 투명 유지 — 어두운 면 위에 놓일 때 흰 상자가 생기지 않게 */
  slugs.forEach((slug, i) => g.drawImage(CHAR_IMG[slug], 96, 0, 32, 48, i * 32 * 6, 0, 32 * 6, 48 * 6));
  return c.toDataURL('image/png');
});
writeFileSync(OUT + '/char-all.png', Buffer.from(sheet.split(',')[1], 'base64'));
console.log('캐릭터 8종 시트');

await browser.close();
