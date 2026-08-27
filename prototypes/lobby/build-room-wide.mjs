/* build-room-wide.mjs — 로비 배경을 옆으로 늘립니다.
 *
 *   node prototypes/lobby/build-room-wide.mjs
 *
 * 왜 필요한가. 로비는 (1) 방 전체가 보이고 (2) 거북이가 화면 왼쪽에
 * 있어야 합니다. 그런데 원본에서 **거북이가 이미 가로 33~50% 자리**라,
 * 원본을 통째로 보여 주면 거북이는 정확히 화면 가운데에 섭니다.
 * 그림을 왼쪽으로 밀면 오른쪽이 비고, 비지 않게 키우면 확대됩니다 —
 * 둘은 원본 하나로는 동시에 안 됩니다.
 *
 * 그래서 오른쪽 벽을 **더 그려서** 그림 자체를 넓힙니다. 넓어진 그림
 * 안에서 거북이는 왼쪽으로 가고, 세로는 원본 990 행이 전부 남습니다.
 *
 * 만드는 법은 두 겹입니다.
 *
 *   1. 가장자리 복제 — 맨 오른쪽 1픽셀 열을 오른쪽으로 늘립니다.
 *      이음매가 원리상 없습니다(늘린 띠의 첫 열 = 원본의 마지막 열).
 *   2. 세로로 뭉갠 판을 그 위에 **왼쪽 0 → 오른쪽 1** 로 서서히 덮습니다.
 *      1번만 쓰면 침대 난간 같은 가로선이 화면 끝까지 그대로 뻗어서
 *      1920 에서 "여기서부터 가짜" 가 눈에 보였습니다. 오른쪽으로 갈수록
 *      뭉개지면 벽이 흐려지며 멀어지는 것으로 읽힙니다.
 *
 * 거울로 뒤집는 방법은 안 씁니다 — 오른쪽 440px 안에 스탠드가 있어서
 * 스탠드가 하나 더 생깁니다.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { statSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'assets/dorm-3d.jpg');
const OUT = join(HERE, 'assets/dorm-3d-wide.jpg');

/* 2800 인 이유 — 화면 비율 2.62 까지 오른쪽이 안 빕니다. 계산은
   index.html 의 .bg-room 주석에 있습니다. */
const TARGET_W = 2800;
/* 덮개가 완전히 불투명해지는 거리. 1920 에서 늘린 띠가 460px 쯤 보이므로
   그 안에서 다 녹아야 합니다. */
const FADE = 300;

const { width, height } = await sharp(SRC).metadata();
if (width >= TARGET_W) { console.log('이미 넓습니다'); process.exit(0); }
const pad = TARGET_W - width;

const lastCol = await sharp(SRC)
  .extract({ left: width - 1, top: 0, width: 1, height })
  .toBuffer();

/* fit:'fill' 이 핵심입니다. 기본값 cover 는 1×990 을 pad×990 에 맞추려고
   세로로 pad 배 늘린 뒤 가운데를 잘라내서, 띠 전체가 **한 색** 이 됩니다
   (실측: 전 행이 229,223,211). fill 이라야 가로로만 늘어납니다. */
const sharpStrip = await sharp(lastCol)
  .resize(pad, height, { kernel: 'nearest', fit: 'fill' })
  .toBuffer();

/* 1×990 을 흐리면 세로로만 번집니다 — 가로에는 번질 것이 없습니다. */
const softStrip = await sharp(lastCol)
  .blur(26)
  .resize(pad, height, { kernel: 'nearest', fit: 'fill' })
  .toBuffer();

/* 왼쪽 0 → FADE 지점 255 인 알파. 행마다 같으므로 한 행을 만들어 반복합니다. */
const alpha = Buffer.alloc(pad * height);
const row = Buffer.alloc(pad);
for (let x = 0; x < pad; x++) {
  const t = Math.min(1, x / FADE);
  /* 선형이면 시작점에서 경계가 보입니다. smoothstep 으로 양 끝을 눕힙니다. */
  row[x] = Math.round(255 * t * t * (3 - 2 * t));
}
for (let y = 0; y < height; y++) row.copy(alpha, y * pad);

const softMasked = await sharp(softStrip)
  .ensureAlpha()
  .joinChannel(alpha, { raw: { width: pad, height, channels: 1 } })
  .png()
  .toBuffer();

const strip = await sharp(sharpStrip)
  .composite([{ input: softMasked, blend: 'over' }])
  .toBuffer();

await sharp({ create: { width: TARGET_W, height, channels: 3, background: '#EFE9DE' } })
  .composite([
    { input: await sharp(SRC).toBuffer(), left: 0, top: 0 },
    { input: strip, left: width, top: 0 },
  ])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log('만듦', OUT.split(/[\\/]/).pop(), meta.width + '×' + meta.height,
            (statSync(OUT).size / 1024 | 0) + 'KB', '· 비율', (meta.width / meta.height).toFixed(3));

/* 이음매 확인 — 붙인 자리 좌우 픽셀이 같아야 합니다. */
const { data, info } = await sharp(OUT).raw().toBuffer({ resolveWithObject: true });
let worst = 0;
for (let y = 0; y < height; y += 7) {
  const a = (y * TARGET_W + width - 1) * info.channels;
  const b = (y * TARGET_W + width) * info.channels;
  for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(data[a + c] - data[b + c]));
}
console.log('이음매 최대 차이', worst, worst <= 8 ? '(안 보임)' : '(확인 필요)');
