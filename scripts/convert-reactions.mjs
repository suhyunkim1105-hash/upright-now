/**
 * 친구 방 반응 이모티콘 변환.
 *
 * <원본 폴더>/NN_<id>.png (1024px 투명 PNG 10장)
 *   → public/assets/reactions/<id>-128.webp / <id>-64.webp
 *
 * 원본 PNG 는 읽기만 하고 지우거나 덮어쓰지 않습니다.
 * 실행: npm run assets:reactions
 *       (원본 폴더가 다르면: node scripts/convert-reactions.mjs <폴더>)
 */
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SRC = process.argv[2] ?? 'C:/Users/수현/Desktop/emoticon-images'
const OUT = 'public/assets/reactions'
const SIZES = [128, 64]
const QUALITY = 85
/** 장당 목표 용량. 넘으면 품질을 한 단계씩만 낮춥니다. */
const MAX_BYTES = 30 * 1024

/** roomEvents.ts 의 ReactionKind 와 같은 목록 — 이름 규칙 검증용 */
const KNOWN_IDS = [
  'cheer', 'reset', 'done', 'fighting', 'same',
  'almost', 'congrats', 'coffee', 'back', 'goodnight',
]

/** 01_cheer.png → 'cheer' */
function parseName(file) {
  const match = /^\d{2}_([a-z]+)\.png$/.exec(file)
  return match ? match[1] : null
}

async function main() {
  const files = (await readdir(SRC)).filter((f) => f.endsWith('.png')).sort()
  await mkdir(OUT, { recursive: true })
  const rows = []

  for (const file of files) {
    const id = parseName(file)
    if (!id) {
      console.log(`건너뜀 (이름 규칙 밖): ${file}`)
      continue
    }
    if (!KNOWN_IDS.includes(id)) {
      console.log(`건너뜀 (반응 id 아님): ${file}`)
      continue
    }

    const srcPath = path.join(SRC, file)
    for (const size of SIZES) {
      let quality = QUALITY
      let buffer = await sharp(srcPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality, effort: 6 })
        .toBuffer()
      while (buffer.length > MAX_BYTES && quality > 60) {
        quality -= 5
        buffer = await sharp(srcPath)
          .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality, effort: 6 })
          .toBuffer()
      }
      const outPath = path.join(OUT, `${id}-${size}.webp`)
      await writeFile(outPath, buffer)
      rows.push({ file: `${id}-${size}.webp`, KB: Math.round(buffer.length / 102.4) / 10, quality })
    }
    void (await stat(srcPath))
  }

  console.table(rows)
  const missing = KNOWN_IDS.flatMap((id) =>
    SIZES.map((s) => `${id}-${s}.webp`),
  ).filter((f) => !rows.some((r) => r.file === f))
  if (missing.length > 0) {
    console.error(`누락: ${missing.join(', ')}`)
    process.exit(1)
  }
  console.log(`완료 — ${rows.length}개 생성 (${KNOWN_IDS.length}종 × ${SIZES.length}크기)`)
}

main()
