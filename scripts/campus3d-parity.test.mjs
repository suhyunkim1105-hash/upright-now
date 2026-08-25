import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const oldWorld = readFileSync('prototypes/openworld/index.html', 'utf8')
const games = readFileSync('prototypes/campus3d/games.js', 'utf8')
const spots = readFileSync('prototypes/campus3d/spots.js', 'utf8')
const world3d = readFileSync('prototypes/campus3d/index.html', 'utf8')
const campus3d = readFileSync('prototypes/campus3d/campus.js', 'utf8')
const ui3d = readFileSync('prototypes/campus3d/ui.js', 'utf8')
const rooms3d = readFileSync('prototypes/campus3d/rooms.js', 'utf8')
const chars3d = readFileSync('prototypes/campus3d/chars.js', 'utf8')

const between = (source, start, end) => {
  const a = source.indexOf(start)
  const b = source.indexOf(end, a + start.length)
  assert.ok(a >= 0 && b > a, `${start} 구간을 찾지 못했습니다`)
  return source.slice(a, b)
}

test('2D 월드의 미니게임은 모두 3D 공간에서 열 수 있다', () => {
  const oldList = between(oldWorld, 'const MINIGAMES = [', '];')
  const oldKeys = [...oldList.matchAll(/panel:\s*'([^']+)'/g)].map((m) => m[1])
  const aliases = {
    animalFind: 'memory',
    animalRunner: 'run',
    animalMatch3: 'match3',
  }
  const retired = new Set(['eggMerge'])

  assert.ok(oldKeys.length >= 8, '2D 미니게임 목록을 충분히 읽지 못했습니다')
  for (const oldKey of oldKeys) {
    if (retired.has(oldKey)) continue
    const key = aliases[oldKey] || oldKey
    assert.match(games, new RegExp(`\\b${key}:\\s*\\{`), `${oldKey}의 3D 게임 정의가 없습니다`)
    assert.match(spots, new RegExp(`game:\\s*'${key}'`), `${oldKey}를 여는 3D 장소가 없습니다`)
  }
})

test('2D 패널 기능마다 3D 대응 기능을 명시한다', () => {
  const panels = between(oldWorld, 'const PANELS = {', 'let panelOpen')
  const oldKeys = [...panels.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):\s*\(/gm)].map((m) => m[1])
  const parity = {
    weather: ['panel', 'weather'], radio: ['panel', 'radio'], calendar: ['panel', 'calendar'],
    campusBoard: ['panel', 'notice-school'], animalFind: ['game', 'memory'],
    postureRun: ['game', 'postureRun'], trackRace: ['game', 'trackRace'],
    pondFish: ['game', 'pondFish'], bookSort: ['game', 'bookSort'],
    animalRunner: ['game', 'run'],
    giraffeNeck: ['game', 'giraffeNeck'], animalMatch3: ['game', 'match3'],
    aboutLibrary: ['room', 'library'], aboutMainhall: ['room', 'mainhall'],
    aboutUnion: ['room', 'union'], arcade: ['room', 'arcade'],
    guide: ['panel', 'guide'], privacy: ['panel', 'privacy'], retro: ['panel', 'retro'],
    hall: ['panel', 'fame'], market: ['panel', 'wear-shop'], coins: ['panel', 'coins'],
    settings: ['panel', 'mypage'],
  }

  assert.deepEqual(oldKeys.filter((key) => key !== 'eggMerge' && !parity[key]), [],
    '대응표에 없는 2D 패널이 생겼습니다')
  for (const [oldKey, [kind, key]] of Object.entries(parity)) {
    const source = kind === 'game' ? games + spots : kind === 'panel' ? world3d + spots : world3d
    const needle = kind === 'game' ? new RegExp(`(?:\\b${key}:\\s*\\{|game:\\s*'${key}')`)
      : kind === 'panel' ? new RegExp(`(?:case\\s+'${key}'|panel:\\s*'${key}')`)
        : new RegExp(`['\"]${key}['\"]`)
    assert.match(source, needle, `${oldKey}의 3D 대응 기능(${key})이 끊겼습니다`)
  }
})

test('분수 옆 게시판은 실제 모델·학교별 공지·공모전 탭까지 연결된다', () => {
  assert.match(campus3d, /boardOut\(g,\s*-8\.6,\s*13\.2/, '학교 게시판 모델이 없습니다')
  assert.match(campus3d, /boardOut\(g,\s*8\.6,\s*13\.2/, '공모전 게시판 모델이 없습니다')
  assert.match(world3d, /DOMAIN_OF\[SAVE\.school\]/, '설정한 학교 도메인을 공지 요청에 쓰지 않습니다')
  assert.doesNotMatch(world3d, /fetch\('\/api\/notice\?school=mju\.ac\.kr'/,
    '학교 공지가 명지대로 고정돼 있습니다')
  assert.match(ui3d, /data-board-tab="school"/, '학교 공지 탭이 없습니다')
  assert.match(ui3d, /data-board-tab="out"/, '대외활동·공모전 탭이 없습니다')
  assert.match(ui3d, /https:\/\/linkareer\.com\/list\/contest/, '링커리어 참여 링크가 없습니다')
})

test('동아리 상점은 카테고리와 3D 상품 그림을 함께 쓴다', () => {
  assert.match(world3d, /import \{ itemThumb \} from '\.\/shopview\.js'/,
    '기존 3D 상품 미리보기 연결이 빠졌습니다')
  assert.match(world3d, /paintThumbs\(elPanel\)/, '패널을 그린 뒤 상품 그림을 채우지 않습니다')
  for (const label of ['상의', '하의', '신발', '모자', '안경', '가방', '탈것'])
    assert.match(ui3d, new RegExp(`['"]${label}['"]`), `옷 가게 ${label} 카테고리가 없습니다`)
  for (const label of ['앉기', '바닥', '수납', '살림', '취미', '초록·불'])
    assert.match(ui3d, new RegExp(`['"]${label}['"]`), `가구 가게 ${label} 카테고리가 없습니다`)
  assert.match(ui3d, /data-egg="\$\{esc\(species\)\}"/, '종별 알 상품 카드가 없습니다')
  assert.match(rooms3d, /const eggDisplay = \[/, '알 여덟 개의 실제 진열이 없습니다')
  assert.equal((between(rooms3d, 'const eggDisplay = [', '];').match(/0x[0-9A-F]{6}/g) || []).length, 8,
    '알 진열 수가 여덟 개가 아닙니다')
  assert.doesNotMatch(games + spots, /eggMerge|거북이 알 합치기/,
    '삭제한 알 합치기 게임이 정의나 상호작용 위치에 남아 있습니다')
})

test('시작 뒤 무거운 작업과 과한 좌우 보행 흔들림을 남기지 않는다', () => {
  assert.doesNotMatch(world3d, /setTimeout\(shootMap,\s*900\)/, '플레이 중 큰 지도 렌더가 남아 있습니다')
  assert.doesNotMatch(world3d, /2400 \+ i \* 650/, '플레이 중 실내 순차 빌드가 남아 있습니다')
  assert.match(chars3d, /root\\\.position\$\/i/, 'GLB 루트 수평 흔들림 보정이 없습니다')
  assert.match(chars3d, /P\.torso\.rotation\.y = s \* \.045/, '몸통 좌우 흔들림 값이 다시 커졌습니다')
})
