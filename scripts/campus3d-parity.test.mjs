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
const mealApi = readFileSync('api/meal.ts', 'utf8')

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

test('분수 옆 게시판 하나에서 학교별 공지·공모전 탭까지 연결된다', () => {
  assert.match(campus3d, /boardOut\(g,\s*-8\.6,\s*13\.2/, '학교 게시판 모델이 없습니다')
  assert.doesNotMatch(campus3d, /boardOut\(g,\s*8\.6,\s*13\.2/, '중복 게시판 모델이 남아 있습니다')
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
  assert.match(world3d, /bare:\s*true/, '옷 상품을 캐릭터가 입은 모습이 아니라 옷만 그리는 설정이 없습니다')
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
  assert.equal((between(spots, 'shop: [', '\n  ],\n};').match(/panel:\s*'wear-shop'/g) || []).length, 1,
    '옷 가게 상호작용이 한 구역보다 많습니다')
  assert.equal((between(spots, 'shop: [', '\n  ],\n};').match(/panel:\s*'egg-shop'/g) || []).length, 1,
    '알 가게 상호작용이 한 구역보다 많습니다')
  assert.equal((between(spots, 'shop: [', '\n  ],\n};').match(/panel:\s*'furn-shop'/g) || []).length, 1,
    '가구 가게 상호작용이 한 구역보다 많습니다')
})

test('기숙사는 안내와 일정 기능을 각각 한 장소의 탭으로 묶는다', () => {
  const dorm = between(spots, 'dorm: [', '\n  ],\n  union:')
  assert.match(dorm, /panel:\s*'schedule'/, '노트북 일정 관리 자리가 없습니다')
  assert.match(dorm, /panel:\s*'dorm-info'/, '출입문 옆 안내 표지판 자리가 없습니다')
  assert.doesNotMatch(dorm, /panel:\s*'(calendar|timetable|wardrobe|guide|privacy)'/,
    '통합 전의 기숙사 개별 자리가 남아 있습니다')
  assert.match(ui3d, /data-schedule-tab="calendar"/, '일정 관리의 구글 캘린더 탭이 없습니다')
  assert.match(ui3d, /data-schedule-tab="timetable"/, '일정 관리의 시간표 탭이 없습니다')
  assert.match(ui3d, /data-info-tab="guide"/, '안내 표지판의 사용 방법 탭이 없습니다')
  assert.match(ui3d, /data-info-tab="privacy"/, '안내 표지판의 개인정보 탭이 없습니다')
})

test('날씨와 학교별 실제 식단은 서버 API 응답을 그대로 표시한다', () => {
  assert.match(world3d, /j\.tempC/, '기상청 API의 현재 기온 필드를 읽지 않습니다')
  assert.match(world3d, /j\.configured === false \|\| j\.ok === false/, '기상청 키·응답 오류를 구분하지 않습니다')
  assert.match(world3d, /fetch\('\/api\/meal\?school='/, '설정한 학교의 식단 API를 부르지 않습니다')
  for (const domain of ['snu.ac.kr', 'yonsei.ac.kr', 'korea.ac.kr', 'skku.edu', 'hanyang.ac.kr',
    'cau.ac.kr', 'khu.ac.kr', 'ewha.ac.kr', 'sogang.ac.kr', 'mju.ac.kr'])
    assert.match(mealApi, new RegExp(`'${domain.replace('.', '\\.')}'`), `${domain} 식단 출처가 없습니다`)
  assert.doesNotMatch(ui3d, /const MENU = \[\['백반'/, '가짜 고정 학식 메뉴가 남아 있습니다')
})

test('시작 뒤 무거운 작업과 과한 좌우 보행 흔들림을 남기지 않는다', () => {
  assert.doesNotMatch(world3d, /setTimeout\(shootMap,\s*900\)/, '플레이 중 큰 지도 렌더가 남아 있습니다')
  assert.doesNotMatch(world3d, /2400 \+ i \* 650/, '플레이 중 실내 순차 빌드가 남아 있습니다')
  assert.match(chars3d, /root\\\.position\$\/i/, 'GLB 루트 수평 흔들림 보정이 없습니다')
  assert.match(chars3d, /P\.torso\.rotation\.y = s \* \.045/, '몸통 좌우 흔들림 값이 다시 커졌습니다')
})
