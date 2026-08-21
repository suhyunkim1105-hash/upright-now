/* ══════════════════════════════════════════════════════════
   감정표현 — ZEP · 배그의 그 바퀴입니다.
   숫자키 1~8 또는 G 를 눌러 바퀴를 열고 고릅니다.
   소리는 **파일을 안 씁니다** — WebAudio 로 그때그때 만듭니다.
   음원 파일을 넣으면 배포본이 무거워지고, 라이선스도 따져야 합니다.
   ══════════════════════════════════════════════════════════ */

export const EMOTES = [
  { k: 'wave',  n: '인사',   e: '👋', dur: 1.6, note: [660, 880],        kind: 'chirp' },
  { k: 'clap',  n: '박수',   e: '👏', dur: 1.8, note: [520, 520, 520],   kind: 'clap'  },
  { k: 'yes',   n: '끄덕',   e: '🙆', dur: 1.2, note: [590, 740],        kind: 'chirp' },
  { k: 'no',    n: '절레',   e: '🙅', dur: 1.2, note: [420, 330],        kind: 'chirp' },
  { k: 'jump',  n: '점프',   e: '⬆️', dur: 1.0, note: [520, 780, 1040],  kind: 'boing' },
  { k: 'dance', n: '춤',     e: '💃', dur: 2.6, note: [523, 659, 784, 659], kind: 'chirp' },
  { k: 'sad',   n: '좌절',   e: '😩', dur: 1.8, note: [400, 320, 250],   kind: 'sigh'  },
  { k: 'love',  n: '하트',   e: '💗', dur: 1.8, note: [784, 988],        kind: 'chirp' },
];
export const EMOTE_BY_KEY = Object.fromEntries(EMOTES.map((e) => [e.k, e]));

/* ---------- 소리 ---------- */
let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
  if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
export function playEmoteSound(k) {
  const E = EMOTE_BY_KEY[k]; if (!E) return;
  const a = ac(); if (!a) return;
  const t0 = a.currentTime;
  const master = a.createGain();
  master.gain.value = .16; master.connect(a.destination);
  if (E.kind === 'clap') {
    E.note.forEach((_, i) => {
      const t = t0 + i * .13;
      const len = Math.floor(a.sampleRate * .06);
      const buf = a.createBuffer(1, len, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let s = 0; s < len; s++) d[s] = (Math.random() * 2 - 1) * Math.pow(1 - s / len, 3);
      const src = a.createBufferSource(); src.buffer = buf;
      const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 1.2;
      src.connect(f); f.connect(master); src.start(t);
    });
    return;
  }
  E.note.forEach((hz, i) => {
    const t = t0 + i * (E.kind === 'boing' ? .07 : .11);
    const o = a.createOscillator(), g = a.createGain();
    o.type = E.kind === 'sigh' ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(hz, t);
    if (E.kind === 'boing') o.frequency.exponentialRampToValueAtTime(hz * 1.7, t + .1);
    if (E.kind === 'sigh') o.frequency.exponentialRampToValueAtTime(hz * .8, t + .28);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + .015);
    g.gain.exponentialRampToValueAtTime(.001, t + (E.kind === 'sigh' ? .35 : .2));
    o.connect(g); g.connect(master); o.start(t); o.stop(t + .4);
  });
}

/* ---------- 모션 ----------
   캐릭터 뼈대(chars.js 의 parts)를 직접 돌립니다. t 는 시작부터의 초. */
export function playEmotePose(g, k, t) {
  const P = g.userData?.parts; if (!P) return false;
  const E = EMOTE_BY_KEY[k]; if (!E) return false;
  if (t > E.dur) return false;
  const b = g.userData.base.armZ;
  const rest = () => {
    P.legs.forEach((l) => { l.rotation.x = 0; l.rotation.z = 0; });
    P.shins.forEach((s) => { s.rotation.x = 0; });
    P.torso.position.y = .44; P.torso.rotation.set(0, 0, 0);
    P.head.position.set(0, 1.48, 0); P.head.rotation.set(0, 0, 0);
    P.arms.forEach((a, i) => { a.rotation.set(-.08, 0, b[i]); });
    g.position.y = 0;
  };
  rest();
  const w = t / E.dur, TAU = Math.PI * 2;
  switch (k) {
    case 'wave': {
      P.arms[1].rotation.z = 2.1;
      P.arms[1].rotation.x = Math.sin(t * 11) * .45;
      P.head.rotation.z = Math.sin(t * 5) * .07;
      break;
    }
    case 'clap': {
      const s = Math.abs(Math.sin(t * 9));
      P.arms.forEach((a, i) => {
        a.rotation.z = (i ? -1 : 1) * (1.0 + s * .5);
        a.rotation.x = -1.15;
      });
      P.torso.rotation.x = .06 + s * .05;
      break;
    }
    case 'yes': {
      P.head.rotation.x = Math.sin(t * 8) * .34;
      P.torso.rotation.x = .05 + Math.sin(t * 8) * .06;
      break;
    }
    case 'no': {
      P.head.rotation.y = Math.sin(t * 9) * .55;
      P.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * .8; a.rotation.x = -.9; });
      break;
    }
    case 'jump': {
      const h = Math.sin(Math.min(1, w * 1.15) * Math.PI);
      g.position.y = h * .62;
      P.legs.forEach((l) => { l.rotation.x = -h * .8; });
      P.shins.forEach((s) => { s.rotation.x = h * 1.2; });
      P.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * (1.5 * h + .2); a.rotation.x = -h * .8; });
      break;
    }
    case 'dance': {
      const s = Math.sin(t * 7);
      P.torso.rotation.z = s * .17; P.torso.rotation.y = s * .3;
      P.torso.position.y = .44 + Math.abs(Math.cos(t * 7)) * .06;
      P.head.rotation.z = -s * .2;
      P.arms.forEach((a, i) => {
        a.rotation.z = (i ? -1 : 1) * (1.2 + s * (i ? -.5 : .5));
        a.rotation.x = -.6 + s * (i ? .5 : -.5);
      });
      P.legs[0].rotation.x = s * .3; P.legs[1].rotation.x = -s * .3;
      break;
    }
    case 'sad': {
      const d = Math.min(1, w * 2.2);
      P.torso.rotation.x = d * .5; P.torso.position.y = .44 - d * .1;
      P.head.rotation.x = d * .7; P.head.position.z = d * .2; P.head.position.y = 1.48 - d * .16;
      P.arms.forEach((a, i) => { a.rotation.z = b[i] * .3; a.rotation.x = d * .5; });
      P.legs.forEach((l) => { l.rotation.x = -d * .25; });
      P.shins.forEach((s) => { s.rotation.x = d * .3; });
      break;
    }
    case 'love': {
      const s = Math.sin(t * 6);
      P.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * 1.35; a.rotation.x = -1.35; });
      P.head.rotation.z = s * .14;
      P.torso.position.y = .44 + Math.abs(s) * .04;
      break;
    }
  }
  return true;
}

/* 머리 위에 뜨는 표시 — 이모지 하나. 3D 로 만들면 무거워서 DOM 으로 띄웁니다. */
export function emoteIcon(k) { return EMOTE_BY_KEY[k]?.e || ''; }
