// favicon.ico 를 prototypes/landing/assets/favicon.svg 에서 굽습니다.
//
// 왜 스크립트인가 — .ico 는 바이너리라 diff 로 뭐가 바뀌었는지 볼 수 없습니다.
// 심볼을 고칠 때 svg 만 고치고 이 스크립트를 다시 돌리면 됩니다.
//
//   node scripts/build-favicon.mjs
//
// .ico 는 PNG 를 그대로 품을 수 있습니다(Vista+). 16·32·48 세 장을 넣습니다.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'prototypes/landing/assets/favicon.svg';
const OUT = 'prototypes/landing/assets/favicon.ico';
const SIZES = [16, 32, 48];

const svg = readFileSync(SRC);
const pngs = await Promise.all(
  SIZES.map((s) => sharp(svg, { density: 384 }).resize(s, s).png({ compressionLevel: 9 }).toBuffer()),
);

const head = Buffer.alloc(6);
head.writeUInt16LE(0, 0);            // reserved
head.writeUInt16LE(1, 2);            // 1 = icon
head.writeUInt16LE(SIZES.length, 4);

let offset = 6 + 16 * SIZES.length;
const entries = SIZES.map((size, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size, 0);             // 폭 (256 이면 0)
  e.writeUInt8(size, 1);             // 높이
  e.writeUInt8(0, 2);                // 팔레트 색 수 — PNG 라 0
  e.writeUInt8(0, 3);                // 예약
  e.writeUInt16LE(1, 4);             // 평면
  e.writeUInt16LE(32, 6);            // 비트 깊이
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});

writeFileSync(OUT, Buffer.concat([head, ...entries, ...pngs]));
console.log(`${OUT} — ${SIZES.join('/')}px, ${(offset / 1024).toFixed(1)}KB`);
