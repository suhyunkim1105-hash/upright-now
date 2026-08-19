/* 랜딩 전체 감사 — 구간·전환·인터랙션·측정치 */
import { createRequire } from 'node:module';
const require_ = createRequire('C:/Users/user/Desktop/girin_mvp/upright-now/package.json');
const { chromium } = require_('playwright');
import { mkdirSync, readdirSync, statSync } from 'node:fs';

const OUT = 'C:/Users/user/Desktop/girin_mvp/prototypes/landing/build/audit';
mkdirSync(OUT, { recursive: true });
const URL = 'file:///C:/Users/user/Desktop/girin_mvp/prototypes/landing/index.html';

/* 에셋 무게 — 배포하면 그대로 전송량이 됩니다 */
const dir = 'C:/Users/user/Desktop/girin_mvp/prototypes/landing/assets';
let png = 0, mp4 = 0;
for (const f of readdirSync(dir)) {
  const st = statSync(dir + '/' + f);
  if (!st.isFile()) continue;
  if (f.endsWith('.png')) png += st.size;
  if (f.endsWith('.mp4')) mp4 += st.size;
}
console.log('PNG 합계', (png / 1048576).toFixed(1), 'MB / MP4 합계', (mp4 / 1048576).toFixed(1), 'MB');

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });

for (const [vw, vh, tag] of [[1440, 900, 'w14'], [1280, 768, 'w12']]) {
  const page = await (await browser.newContext({ viewport: { width: vw, height: vh } })).newPage();
  await page.goto(URL);
  await page.waitForTimeout(4500);
  const total = await page.evaluate(() => document.body.scrollHeight);
  if (tag === 'w14') console.log('높이', total, 'px');

  const at = async (name, y) => {
    await page.evaluate(v => scrollTo(0, v), Math.max(0, Math.min(total - vh, Math.round(y))));
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  };

  /* 섹션 오프셋을 실제 DOM 에서 읽어 정확히 찍습니다 */
  const off = await page.evaluate(() => {
    const q = s => document.querySelector(s)?.offsetTop ?? 0;
    const h = s => document.querySelector(s)?.offsetHeight ?? 0;
    return {
      portal: q('.portal'), portalH: h('.portal'),
      world: q('.world'), worldH: h('.world'),
      intro: q('.intro'), introH: h('.intro'),
      mani: q('.manifesto'), maniH: h('.manifesto'),
      spaces: q('.spaces'), story: q('.story'),
      rhythm: q('.rhythm'), deck: q('.deck-sec'), faq: q('#faq'),
      voices: q('.voices'), journal: q('.journal'), contact: q('.contact'),
    };
  });

  await at('01-hero', 0);
  await at('02-hero-half', vh * .55);                     /* 히어로에서 포털로 넘어가는 순간 */
  await at('03-portal-early', off.portal + off.portalH * .18);
  await at('04-portal-expand', off.portal + off.portalH * .55);
  await at('05-portal-end', off.portal + off.portalH - vh * 1.05);
  await at('06-handoff', off.world - vh * .4);            /* 포털→체인 경계 */
  await at('07-chain-d1', off.world + vh * .7);
  await at('08-chain-c1', off.world + vh * 1.75);         /* 커넥터 중간 */
  await at('09-chain-d2', off.world + vh * 2.6);
  await at('10-chain-d3', off.world + vh * 4.9);
  await at('11-chain-d4', off.world + vh * 6.6);          /* 기숙사 끝 + CTA */
  await at('12-intro-mid', off.intro + off.introH * .45);
  await at('13-mani-early', off.mani + off.maniH * .2);
  await at('14-mani-late', off.mani + off.maniH * .75);
  await at('15-space-seam', off.spaces + vh * 1.5);       /* 패널 1→2 겹침 */
  await at('16-space-story-seam', off.story - vh * .5);   /* 패널 3→스토리 경계 */
  await at('17-story', off.story + vh * .3);
  await at('18-rhythm', off.rhythm + vh * .2);
  await at('19-deck', off.deck + vh * .25);
  await at('20-faq', off.faq + vh * .15);
  await at('21-voices', off.voices);
  await at('22-journal', off.journal);
  await at('23-contact', off.contact + vh * .2);
  await at('24-footer', total);

  if (tag === 'w14') {
    /* 인터랙션 상태 */
    await page.evaluate(v => scrollTo(0, v), off.faq);
    await page.waitForTimeout(600);
    await page.click('.qa:nth-child(1) .qa-btn');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/ix-faq-open.png` });

    await page.evaluate(v => scrollTo(0, v), off.rhythm + 200);
    await page.waitForTimeout(500);
    await page.hover('.r-row:nth-child(2)');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/ix-row-hover.png` });

    await page.evaluate(v => scrollTo(0, v), off.voices - 80);
    await page.waitForTimeout(500);
    await page.hover('.voice:nth-child(1)');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/ix-voice-hover.png` });

    /* 체인 스크럽이 실제로 영상 시간을 움직이나 */
    await page.evaluate(v => scrollTo(0, v), off.world + vh * .5);
    await page.waitForTimeout(900);
    const t1 = await page.evaluate(() => [...document.querySelectorAll('.w-scene video')].map(v => +v.currentTime.toFixed(2)));
    await page.evaluate(v => scrollTo(0, v), off.world + vh * 1.1);
    await page.waitForTimeout(900);
    const t2 = await page.evaluate(() => [...document.querySelectorAll('.w-scene video')].map(v => +v.currentTime.toFixed(2)));
    console.log('스크럽 t1', JSON.stringify(t1), '→ t2', JSON.stringify(t2));

    /* 렌더 타이포 실측 */
    const type = await page.evaluate(() => {
      const gs = (s, p) => { const el = document.querySelector(s); return el ? getComputedStyle(el)[p] : '-'; };
      return {
        h1: gs('.hero h1', 'fontSize'),
        h2: gs('.rhythm-head h2', 'fontSize'),
        chainH3: gs('.w-copy h3', 'fontSize'),
        body: gs('.lede', 'fontSize'),
        font: gs('body', 'fontFamily').slice(0, 40),
      };
    });
    console.log('타이포', JSON.stringify(type));

    /* 키보드 — 탭 12번의 포커스 경로 */
    await page.evaluate(() => scrollTo(0, 0));
    const path = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      path.push(await page.evaluate(() => {
        const a = document.activeElement;
        return a ? (a.className || a.tagName).toString().slice(0, 24) : '?';
      }));
    }
    console.log('탭 경로', JSON.stringify(path));
  }
  await page.context().close();
}
await browser.close();
console.log('감사 스크린샷 완료');
