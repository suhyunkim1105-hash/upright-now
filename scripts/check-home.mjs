/* 메인 화면 자동 점검
   ==================================================================
   이 세션에서 **눈으로 못 잡은 회귀가 세 번** 있었습니다.

     · 주석을 닫지 않아 청록·먹 판의 배경 규칙이 통째로 먹혔습니다.
       화면은 흰 종이가 됐는데 JS 에러도 콘솔 경고도 없었습니다.
     · 세션 시작 판의 설명을 걷어내면서 규칙을 지웠는데, 랭킹전 판이
       같은 클래스를 쓰고 있어 거기만 평문으로 떨어졌습니다.
     · 입장 애니메이션의 fill: both 가 transform 을 붙들어 판 호버가
       통째로 죽었습니다. 계산된 값을 재기 전까지 몰랐습니다.

   셋 다 "돌긴 도는데 틀린" 종류라, 열어 보고 넘어가면 안 걸립니다.
   그래서 **재는 것**을 남깁니다.

   실행
     node scripts/check-home.mjs
     node scripts/check-home.mjs --update      기준 그림 다시 찍기

   서버가 필요합니다 (.claude/launch.json 의 deskfit):
     npx http-server . -p 8177 -c-1
   ================================================================== */

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.HOME_URL || 'http://localhost:8177/prototypes/home/index.html';
const SHOTS = 'scripts/__shots__';
const UPDATE = process.argv.includes('--update');

/* 시계를 못 박습니다. 세션 기록이 "지금" 기준으로 그려지므로, 안 박으면
   기준 그림이 실행할 때마다 달라지고 — 늘 다른 기준 그림은 아무도 안
   봅니다. 2026-08-19 12:00 KST. */
const NOW = Date.parse('2026-08-19T03:00:00Z');

/* 1280 은 가장 낮은 지원 화면입니다 — 넘침이 여기서 먼저 납니다.
   1440 이 기준이고, 1680 은 위쪽 여백이 벌어지는 쪽입니다. */
const SIZES = [[1280, 768], [1440, 900], [1680, 1050]];

/* 화면에 그려지는 값은 전부 시작할 때 한 번 읽습니다. 그래서 상태를
   바꾸려면 넣고 **다시 열어야** 합니다. */
const SEED = {
  'girin.room': JSON.stringify({
    nickname: '민철', school: '명지대학교', schoolVerifiedAt: '2026-08-14',
    character: '기린', coins: 640,
    owned: ['top-varsity', 'bot-jeans'],
    worn: { top: 'top-varsity', bottom: 'bot-jeans' },
  }),
  'girin.reward': JSON.stringify({ level: 7 }),
  'girin.baseline': JSON.stringify({
    version: 3, features: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 },
    shoulderWidthMedian: 0.312, sampleCount: 214, createdAt: 1755500000000,
  }),
};

let failed = 0;
const fail = (m) => { console.log('  ✗ ' + m); failed++; };
const pass = (m) => console.log('  · ' + m);

/** 세로 넘침은 안 봅니다 — 마이페이지처럼 내용이 긴 화면은 본문 칸이
    스크롤되는 것이 정상입니다. 가로가 넘치면 그건 언제나 버그입니다. */
const overflowX = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

/** 버튼 라벨을 보고 넘깁니다. 클릭 횟수로 세면 단계가 하나 늘거나 줄 때
    조용히 어긋나서, 엉뚱한 화면을 검사하고도 통과합니다. */
async function walkWizard(page) {
  await page.click('[data-vis=private]');
  for (let i = 0; i < 12; i++) {
    const label = await page.$eval('#wizGoLabel', (e) => e.textContent.trim());
    if (label === '방 만들기') { await page.click('#wizGo'); break; }
    await page.click('#wizGo');
    await page.waitForTimeout(620);
  }
  await page.waitForFunction(
    () => document.querySelector('#wizGoLabel').textContent.trim() === '대기실로',
    null, { timeout: 15000 });
  await page.click('#wizGo');
  await page.waitForTimeout(900);
}

async function shot(page, name, mask) {
  mkdirSync(SHOTS, { recursive: true });
  const path = join(SHOTS, name + '.png');
  /* 무작위로 그려지는 것은 가립니다 — 발급 코드가 그렇습니다. 값 자체는
     문자표 검사가 따로 봅니다. 안 가리면 기준 그림이 매번 달라지고,
     늘 달라지는 기준은 아무도 안 봅니다. */
  /* 서체가 다 오기를 기다립니다. Wanted Sans 는 유니코드 구간별로 92개
     로 쪼개져 있어서, 어느 조각이 아직 안 왔느냐에 따라 같은 화면이
     다르게 그려집니다 — 두 번 돌리면 두 번 다른 기준 그림이 나옵니다. */
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({
    animations: 'disabled',
    mask: mask ? mask.map((s) => page.locator(s)) : undefined,
  });
  if (UPDATE || !existsSync(path)) {
    writeFileSync(path, buf);
    pass('그림 저장 ' + name);
    return;
  }
  /* **바이트가 아니라 픽셀을 셉니다.** 처음엔 바이트로 비교했는데 세 번
     연달아 돌려도 매번 다른 파일이 달라졌습니다 — 서체 서브셋이 오는
     순서, 안티에일리어싱 한 픽셀만으로도 바이트는 바뀝니다. 매번 우는
     경보는 사람이 곧 안 읽습니다.

     지금은 채널값 차이가 8을 넘는 픽셀만 세고, 그런 픽셀이 전체의 0.05%
     를 넘을 때만 말합니다. 글자 한 줄이 바뀌어도 그 선은 넘습니다. */
  const prev = readFileSync(path);
  const diff = await pixelDiff(prev, buf);
  if (diff === null) {
    console.log('  ! 그림 크기가 달라졌어요 ' + name);
  } else if (diff > 0.0005) {
    const out = join(SHOTS, name + '.new.png');
    writeFileSync(out, buf);
    console.log('  ! 그림이 달라졌어요 ' + name + ' (' + (diff * 100).toFixed(2) + '%) → ' + out);
  }
}

/** 다른 픽셀의 비율. 크기가 다르면 null. */
async function pixelDiff(a, b) {
  const raw = (buf) => sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const [x, y] = await Promise.all([raw(a), raw(b)]);
  if (x.data.length !== y.data.length) return null;
  const ch = x.info.channels;
  let bad = 0;
  for (let i = 0; i < x.data.length; i += ch) {
    if (Math.abs(x.data[i] - y.data[i]) > 8
      || Math.abs(x.data[i + 1] - y.data[i + 1]) > 8
      || Math.abs(x.data[i + 2] - y.data[i + 2]) > 8) bad++;
  }
  return bad / (x.data.length / ch);
}

const browser = await chromium.launch();

for (const [w, h] of SIZES) {
  console.log('\n=== ' + w + '×' + h + ' ===');
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  /* Date 를 통째로 못 박습니다. page.clock 은 타이머까지 멈춰서 전환·
     스프링이 안 도므로 쓰지 않습니다 — 필요한 건 **시각**뿐입니다. */
  await page.addInitScript((t) => {
    const Real = Date;
    const Fixed = class extends Real {
      constructor(...a) { super(...(a.length ? a : [t])); }
      static now() { return t; }
    };
    globalThis.Date = Fixed;
  }, NOW);

  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  /* ---- 빈 상태 ---- */
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(900);
  if (await overflowX(page)) fail('빈 상태 · 세션 시작 가로 넘침');
  if (w === 1440) await shot(page, 'empty-start');

  await page.click('[data-nav=char]');
  await page.waitForTimeout(600);
  const emptyWardrobe = await page.$('.empty');
  if (!emptyWardrobe) fail('옷이 없는데 옷장 빈 상태가 안 나옴');
  else pass('옷장 빈 상태');

  /* ---- 채워진 상태 ---- */
  await page.evaluate((seed) => {
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    const D = 86400000, now = Date.now(), rows = [];
    for (const [ago, min, zone, rec] of [[5, 52, 'library', 3], [2, 68, 'library', 5], [0, 38, 'mainhall', 2]]) {
      const at = now - ago * D - 1800000, d = new Date(at), ms = min * 60000;
      rows.push({
        date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
        at, zone, minutes: min, seatedMs: ms, recoveries: rec,
        goodMs: ms * 0.74, warnMs: ms * 0.19, badMs: ms * 0.07,
      });
    }
    localStorage.setItem('girin.sessions', JSON.stringify(rows));
  }, SEED);
  await page.reload();
  await page.waitForTimeout(900);

  /* ---- 판이 살아 있는가 ----
     주석 하나를 안 닫아서 두 판의 배경이 통째로 사라진 적이 있습니다.
     보이는 것을 믿지 말고 계산된 값을 잽니다. */
  const gates = await page.evaluate(() => [...document.querySelectorAll('#v-start .gate')]
    .map((e) => getComputedStyle(e).backgroundColor));
  if (gates[0] !== 'rgb(45, 212, 191)') fail('방 판 배경이 청록이 아님: ' + gates[0]);
  else if (gates[1] !== 'rgb(23, 32, 30)') fail('월드 판 배경이 먹이 아님: ' + gates[1]);
  else pass('두 판 배경');

  /* ---- 판 호버 ----
     입장 애니메이션의 fill 이 transform 을 붙들면 여기서만 걸립니다. */
  await page.mouse.move(Math.round(w * 0.45), Math.round(h * 0.72));
  await page.waitForTimeout(280);
  const lifted = await page.evaluate(() =>
    getComputedStyle(document.querySelector('#v-start .gate-night')).transform);
  if (!/matrix\(1, 0, 0, 1, 0, -3\)/.test(lifted)) fail('월드 판이 호버에 안 떠오름: ' + lifted);
  else pass('판 호버');
  await page.mouse.move(0, 0);

  /* ---- 타이포 계약 (prototypes/DESIGN.md §2) ---- */
  const type = await page.evaluate(() => {
    let w420 = 0, neg = 0;
    document.querySelectorAll('*').forEach((e) => {
      if (!e.textContent.trim()) return;
      const c = getComputedStyle(e);
      if (c.display === 'none') return;
      if (c.fontVariationSettings.includes('420')) w420++;
      if (parseFloat(c.letterSpacing) < 0) neg++;
    });
    const b = getComputedStyle(document.body);
    return { w420, neg, size: b.fontSize, weight: b.fontWeight };
  });
  if (type.size !== '15px') fail('본문 크기가 15px 이 아님: ' + type.size);
  if (type.weight !== '500') fail('본문 무게가 500 이 아님: ' + type.weight);
  if (type.w420) fail('420 으로 그려지는 요소 ' + type.w420 + '개');
  if (type.neg) fail('음수 자간 ' + type.neg + '곳');
  if (type.size === '15px' && !type.w420 && !type.neg) pass('타이포 계약');

  /* ---- 초점 링이 면을 따라가는가 ----
     하나로 고정하면 청록 판 위 2.92, 먹 판 위 3.06 으로 비텍스트 UI 기준
     3:1 을 못 넘거나 겨우 걸칩니다. 키보드로만 쓰는 사람에게는 이 선이
     "지금 어디" 의 전부입니다. */
  const rings = await page.evaluate(() => {
    const v = (s) => getComputedStyle(document.querySelector(s)).getPropertyValue('--focus').trim();
    return { teal: v('.gate-teal'), night: v('.gate-night'), root: v(':root') };
  });
  if (rings.teal === rings.root || rings.night === rings.root) {
    fail('초점 링이 면마다 안 바뀜: ' + JSON.stringify(rings));
  } else pass('초점 링 ' + rings.root + ' / 청록 ' + rings.teal + ' / 먹 ' + rings.night);

  /* ---- 화면마다: 가로 넘침 · axe ---- */
  const scan = async (label) => {
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    for (const v of r.violations) {
      fail(label + ' [' + v.impact + '] ' + v.id + ' (' + v.nodes.length + '곳) ' + v.nodes[0].target.join(' '));
    }
  };

  for (const v of ['start', 'char', 'league', 'my']) {
    await page.click('[data-nav=' + v + ']');
    await page.waitForTimeout(650);
    if (await overflowX(page)) fail(v + ' 가로 넘침');
    if (w === 1440) await scan(v);
  }
  for (const t of ['log', 'base', 'save', 'set']) {
    await page.click('[data-my=' + t + ']');
    await page.waitForTimeout(650);
    if (await overflowX(page)) fail('my/' + t + ' 가로 넘침');
    if (w === 1440) { await scan('my/' + t); await shot(page, 'my-' + t + '-' + w); }
  }

  /* ---- 랭킹전 판의 세 층 ----
     같은 클래스를 쓰는 다른 화면의 규칙을 지워 여기만 평문이 된 적이
     있습니다. 아이브로우가 본문 크기면 위계가 무너진 것입니다. */
  await page.click('[data-nav=league]');
  await page.waitForTimeout(600);
  const lg = await page.evaluate(() => {
    const k = getComputedStyle(document.querySelector('#v-league .gkind'));
    const s = getComputedStyle(document.querySelector('#v-league .gsub'));
    return { k: k.fontSize, ko: k.opacity, s: s.fontSize };
  });
  if (lg.k !== '12px' || lg.s !== '14px' || lg.ko === '1') {
    fail('랭킹전 판 위계가 무너짐: 아이브로우 ' + lg.k + '/투명도 ' + lg.ko + ', 부제 ' + lg.s);
  } else pass('랭킹전 판 위계');
  if (w === 1440) await shot(page, 'league-' + w);

  /* ---- 위저드 전 구간 ---- */
  await page.click('[data-nav=start]');
  await page.click('[data-go=wizard]');
  await page.waitForTimeout(800);
  if (w === 1440) await scan('위저드1');
  await walkWizard(page);
  if (w === 1440) { await scan('대기실'); await shot(page, 'lobby-' + w, ['#lobbyCode']); }

  const code = await page.$eval('#lobbyCode', (e) => e.textContent.trim());
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code)) {
    fail('발급 코드가 규칙 밖: ' + code);
  } else pass('코드 발급 ' + code);

  /* ---- 기준 없이는 시작 못 함 ----
     대기실이 "모두 자세 기준을 확인하면" 이라고 적어 놓고 열어 두면
     안 됩니다. 기준 없이 시작하면 세션이 판정을 못 합니다. */
  await page.evaluate(() => localStorage.removeItem('girin.baseline'));
  await page.reload();
  await page.waitForTimeout(900);
  await page.click('[data-go=wizard]');
  await page.waitForTimeout(800);
  await walkWizard(page);
  if (!(await page.$eval('#lobbyStart', (e) => e.disabled))) {
    fail('자세 기준이 없는데 시작 버튼이 열려 있음');
  } else pass('기준 없으면 시작 막힘');

  if (errs.length) fail('JS 에러 ' + errs.length + '건: ' + errs.slice(0, 2).join(' | '));
  else pass('JS 에러 없음');

  await ctx.close();
}

await browser.close();
console.log(failed ? '\n실패 ' + failed + '건' : '\n다 통과');
process.exit(failed ? 1 : 0);
