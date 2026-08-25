/* ══════════════════════════════════════════════════════════
   배경음악 — 2D 판이 쓰던 **같은 파일 열 곡**을 그대로 씁니다.
   (`../openworld/assets/audio/*.ogg`, 전부 CC0. 라이선스는
   OPEN_SOURCE_CREDITS.md 에 적혀 있습니다.)

   3D 판은 WebAudio 로 만든 장소 소리만 있었습니다. 그건 "이 방이 조용한
   방" 이라는 정보는 주지만 곡은 아닙니다 — 2D 를 해 본 사람이 3D 에
   들어오면 제일 먼저 비어 있다고 느끼는 자리가 여기였습니다.

   받아 둔 곡은 다시 안 받습니다. 문을 지날 때마다 네트워크가 돌면
   방 사이를 오갈 때 소리가 끊깁니다. 열 곡을 다 들러도 2.4MB 입니다.
   ══════════════════════════════════════════════════════════ */

export const MUSIC = {
  calm:   { name: '도서관 · 조용한 오후',  file: 'calm.ogg',   by: 'LightMister' },
  bright: { name: '캠퍼스 · 볕 드는 마당', file: 'bright.ogg', by: 'SondreDrakensson' },
  warm:   { name: '기숙사 · 저녁 방',      file: 'warm.ogg',   by: 'Erokia' },
  night:  { name: '집중 ASMR · 늦은 밤',   file: 'night.ogg',  by: 'szegvari' },
  errand: { name: '학생회관 · 볼일 보는 길', file: 'errand.ogg', by: 'Leszek_Szary' },
  play:   { name: '미니게임관 · 삼 분만',  file: 'play.ogg',   by: 'michorvath' },
  shop:   { name: '동아리 상점 · 좌판 앞', file: 'shop.ogg',   by: 'Rolly-SFX' },
  noon:   { name: '집중 ASMR · 한낮',       file: 'noon.ogg',   by: 'pinkinblue' },
  study:  { name: '집중 ASMR · 창가 자리', file: 'study.ogg',  by: 'Hakren' },
  water:  { name: '집중 ASMR · 물가',       file: 'water.ogg',  by: 'SondreDrakensson' },
};
/* 장소별 기본 곡 — 2D 와 같은 배정입니다.
   본관은 도서관과 같은 곡을 씁니다. 둘 다 "오래 앉는 자리" 하나라,
   음악까지 다르면 공간이 아니라 곡이 기억에 남습니다. */
export const ZONE_TRACK = {
  library: 'calm', mainhall: 'calm', dorm: 'warm', union: 'errand',
  campus: 'bright', arcade: 'play', shop: 'shop', clubshop: 'shop',
};
const DIR = '../openworld/assets/audio/';

export function createMusic(opt = {}) {
  let on = opt.on !== false, vol = opt.vol ?? .45, pick = opt.pick || 'auto';
  let cur = null, el = null, want = null, token = 0;
  const cache = new Map();

  function pickFor(zone) {
    if (pick !== 'auto') return pick;
    return ZONE_TRACK[zone] || 'bright';
  }
  async function play(id) {
    if (!on || !id || id === cur) return;
    const my = ++token;
    cur = id;
    let url = cache.get(id);
    if (!url) { url = DIR + (MUSIC[id]?.file || 'bright.ogg'); cache.set(id, url); }
    if (!el) { el = new Audio(); el.loop = true; }
    /* 늦게 온 것이 지금 곡을 덮지 않게 번호표를 봅니다 — 도서관 문을 열자마자
       나오면 두 곡이 겹쳐 나던 자리입니다. */
    if (my !== token) return;
    fade(0, () => {
      if (my !== token) return;
      el.src = url; el.volume = 0;
      el.play().then(() => fade(vol)).catch(() => {});
    });
  }
  let fadeT = 0;
  function fade(to, then) {
    clearInterval(fadeT);
    if (!el) { then?.(); return; }
    const from = el.volume, t0 = performance.now();
    fadeT = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / 420);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) { clearInterval(fadeT); then?.(); }
    }, 40);
  }
  return {
    get on() { return on; }, get vol() { return vol; }, get pick() { return pick; },
    get playing() { return cur; },
    setZone(z) { want = z; play(pickFor(z)); },
    setOn(v) { on = v; if (!on) { fade(0, () => { el?.pause(); cur = null; }); } else play(pickFor(want)); },
    setVol(v) { vol = Math.max(0, Math.min(1, v)); if (el && cur) el.volume = vol; },
    setPick(p) { pick = p; cur = null; play(pickFor(want)); },
  };
}
