/**
 * 승인 에셋 검증 — public/assets 산출물이 완전한지 확인합니다.
 * 실행: npm run assets:verify
 */
import sharp from 'sharp'
import { existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'assets')

const required = []
const optional = []

for (let stage = 1; stage <= 6; stage += 1) {
  const st = String(stage).padStart(2, '0')
  for (const size of [256, 512, 1024]) {
    required.push(`characters/stages/stage-${st}/idle-${size}.webp`)
  }
}
for (const monster of ['bookmong', 'neulmong']) {
  for (let phase = 1; phase <= 4; phase += 1) {
    const p = String(phase).padStart(2, '0')
    for (const size of [256, 512, 1024]) {
      required.push(`monsters/${monster}/phase-${p}/idle-${size}.webp`)
    }
  }
}
// 꼬몽이는 승인 ZIP 이 있을 때만 — optional 로 검사 (있으면 4 phase 전부 요구)
for (let phase = 1; phase <= 4; phase += 1) {
  const p = String(phase).padStart(2, '0')
  for (const size of [256, 512, 1024]) {
    optional.push(`monsters/komong/phase-${p}/idle-${size}.webp`)
  }
}
for (const itemId of ['jacket-navy', 'jacket-burgundy', 'jacket-forest', 'jacket-coral']) {
  for (let stage = 1; stage <= 6; stage += 1) {
    required.push(
      `store/layers/jackets/${itemId}/stage-${String(stage).padStart(2, '0')}.webp`,
    )
  }
}
for (const itemId of ['backpack-freshman', 'backpack-library', 'backpack-team']) {
  for (let stage = 1; stage <= 6; stage += 1) {
    const st = String(stage).padStart(2, '0')
    required.push(`store/layers/backpacks/${itemId}/stage-${st}-back.webp`)
    required.push(`store/layers/backpacks/${itemId}/stage-${st}-front.webp`)
  }
}
// 친구 방 반응 이모티콘 10종 × 2크기 (scripts/convert-reactions.mjs 산출물)
for (const id of [
  'cheer', 'reset', 'done', 'fighting', 'same',
  'almost', 'congrats', 'coffee', 'back', 'goodnight',
]) {
  for (const size of [64, 128]) {
    required.push(`reactions/${id}-${size}.webp`)
  }
}
for (const id of [
  'shoulder-roll',
  'scapular-squeeze',
  'wrist-forearm',
  'seated-torso-rotation',
  'neck-side-movement',
  'calf-raise',
]) {
  required.push(`stretch/cards/${id}.webp`)
}
for (const width of [768, 1024, 1536]) {
  required.push(`campus/campus-map-bg-${width}.webp`)
}
required.push('campus/campus-map-bg.webp')

let missing = 0
let broken = 0
const komongPresent = optional.some((rel) => existsSync(join(OUT, rel)))

async function check(rel, mandatory) {
  const p = join(OUT, rel)
  if (!existsSync(p)) {
    if (mandatory) {
      console.error(`MISSING: ${rel}`)
      missing += 1
    }
    return
  }
  if (statSync(p).size < 1000) {
    console.error(`TOO SMALL: ${rel}`)
    broken += 1
    return
  }
  try {
    const meta = await sharp(p).metadata()
    if (meta.format !== 'webp') {
      console.error(`NOT WEBP: ${rel}`)
      broken += 1
    }
  } catch {
    console.error(`BROKEN: ${rel}`)
    broken += 1
  }
}

for (const rel of required) await check(rel, true)
for (const rel of optional) await check(rel, komongPresent)

console.log(
  JSON.stringify(
    {
      requiredChecked: required.length,
      komongPresent,
      missing,
      broken,
    },
    null,
    2,
  ),
)
if (missing > 0 || broken > 0) process.exit(1)
