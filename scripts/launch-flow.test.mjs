import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const landing = readFileSync('prototypes/landing/index.html', 'utf8')
const onboarding = readFileSync('prototypes/onboarding/index.html', 'utf8')
const deskfit = readFileSync('prototypes/deskfit/index.html', 'utf8')
const build = readFileSync('scripts/copy-prototypes.mjs', 'utf8')

test('랜딩에서 최신 3D 월드까지 한 줄로 이어진다', () => {
  assert.match(landing, /\.\.\/onboarding\/index\.html/, '랜딩 CTA가 온보딩으로 가지 않습니다')
  assert.match(onboarding, /location\.href\s*=\s*'\.\.\/deskfit\/index\.html'/,
    '온보딩 완료 뒤 메인으로 가지 않습니다')
  assert.match(deskfit, /location\.href\s*=\s*'\.\.\/campus3d\/index\.html'/,
    '메인의 월드 입장이 3D 월드맵으로 가지 않습니다')
  for (const folder of ['landing', 'onboarding', 'deskfit', 'campus3d']) {
    assert.match(build, new RegExp(`['"]${folder}['"]`), `${folder}가 배포 폴더 목록에 없습니다`)
    assert.ok(existsSync(`prototypes/${folder}/index.html`), `${folder}/index.html이 없습니다`)
  }
})

test('최신 3D 월드가 사용하는 서버 기능도 통합되어 있다', () => {
  for (const file of ['api/notice.ts', 'api/meal.ts', 'api/weather.ts'])
    assert.ok(existsSync(file), `${file}이 없습니다`)
})
