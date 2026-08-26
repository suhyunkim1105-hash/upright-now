import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cafeteria, tour, wearShop, calendarEmbed, calendarOpenLink } from '../prototypes/campus3d/ui.js'
import { SPOTS } from '../prototypes/campus3d/spots.js'
import { INDOOR } from '../prototypes/campus3d/npcs.js'

const world = readFileSync('prototypes/campus3d/index.html', 'utf8')
const rooms = readFileSync('prototypes/campus3d/rooms.js', 'utf8')
const games = readFileSync('prototypes/campus3d/games.js', 'utf8')
const spots = readFileSync('prototypes/campus3d/spots.js', 'utf8')
const chars = readFileSync('prototypes/campus3d/chars.js', 'utf8')
const shopview = readFileSync('prototypes/campus3d/shopview.js', 'utf8')
const weatherApi = readFileSync('api/weather.ts', 'utf8')
const emote = readFileSync('prototypes/campus3d/emote.js', 'utf8')
const npcs = readFileSync('prototypes/campus3d/npcs.js', 'utf8')
const plan = readFileSync('prototypes/campus3d/plan.js', 'utf8')
const buildings = readFileSync('prototypes/campus3d/bld.js', 'utf8')
const WEAR = {
  top: [['tee', '반팔티', 0], ['hoodie', '후드티', 60], ['shirt', '셔츠', 50], ['varsity', '과잠', 90]],
  bottom: [['jeans', '청바지', 0], ['trainers', '트레이닝', 40], ['slacks', '슬랙스', 50], ['shorts', '반바지', 40]],
  shoes: [['sneakers', '운동화', 0], ['slippers', '슬리퍼', 30], ['dress', '구두', 60]],
  hat: [['none', '없음', 0], ['cap', '볼캡', 50], ['beanie', '비니', 50], ['grad_cap', '학사모', 90]],
  glasses: [['none', '없음', 0], ['round', '동그란테', 40], ['horn', '뿔테', 40], ['sunglasses', '선글라스', 60]],
  bag: [['backpack', '백팩', 0], ['tote', '에코백', 50], ['none', '없음', 0]],
}

test('옷 가게의 모든 카테고리 상품이 공유 WebGL의 3D 클레이 칸으로 보인다', () => {
  for (const [slot, items] of Object.entries(WEAR)) {
    const out = wearShop({
      wear: WEAR, owned: [], coins: 999, category: slot, schoolColor: 0x862633,
      rides: [], ownedRide: [], onCategory() {}, onBuy() {},
    }).html
    const expected = items.filter(([id]) => id !== 'none').length
    assert.equal((out.match(/data-wear-art=/g) || []).length, expected, `${slot} 카드 수`)
    for (const [id] of items.filter(([id]) => id !== 'none'))
      assert.match(out, new RegExp(`data-wear-art="${id}"`), `${slot}/${id} 미리보기`)
  }
  assert.match(world, /querySelectorAll\('button\[data-buy\] \.th'\)/, '옷 3D 렌더 대상 연결')
  assert.match(world, /itemThumb\(el, 'wear'/, '공유 WebGL 옷 조형 렌더')
  assert.match(world, /species: curSpecies/, '뽑아 선택한 캐릭터 입어보기')
  assert.match(shopview, /procedural:\s*true/, 'GLB 골조에서 분리할 수 없는 상품 카드가 다시 빈 칸이 됩니다')
  assert.match(shopview, /dataset\.renderState = ok \? 'ready' : 'error'/,
    '3D 상품 카드 렌더 성공 여부를 검수할 수 없습니다')
  assert.match(world, /tryOn\(WEAR_TRY\)\?\.focus\(null\)/,
    '옆 미리보기가 상품 부위만 확대해 원본 캐릭터 얼굴·전신을 자릅니다')
  assert.match(world, /try: WEAR_TRY, focus: null/,
    '상점을 다시 열면 옆 원본 캐릭터가 전신 대신 잘린 상태로 시작합니다')
})

test('상점 제목은 고정되고 본문만 스크롤되어 카테고리와 겹치지 않는다', () => {
  assert.match(world, /#panel\{[^}]*overflow:hidden[^}]*display:flex[^}]*flex-direction:column/,
    '팝업 전체가 스크롤되어 상점 제목이 카테고리 뒤로 들어갑니다')
  assert.match(world, /#panel \.ph\{[^}]*position:relative[^}]*flex:none/,
    '팝업 제목 영역이 고정 레이아웃이 아닙니다')
  assert.match(world, /#panel \.bd\{[^}]*overflow:auto[^}]*min-height:0/,
    '팝업 본문만 독립적으로 스크롤하지 않습니다')
  assert.match(world, /\.shop-tabs\{[^}]*position:sticky[^}]*top:0/,
    '긴 상품 목록에서 카테고리 탭이 안전하게 고정되지 않습니다')
})

test('학교 선택은 옷장이 아니라 MY에서 공지·학식·채팅과 함께 바뀐다', () => {
  assert.doesNotMatch(world, /data-sc=/, '옷장에 이전 학교 선택 버튼이 남아 있습니다')
  assert.match(world, /onSchool:\s*\(school, again\) => \{ chooseSchool\(school\); again\(\); \}/)
  assert.match(world, /function chooseSchool\(name\)/)
  assert.match(world, /ntKey = ''; ntState = 'idle'; ntData = null;/)
  assert.match(world, /mealKey = ''; mealState = 'idle'; mealData = undefined;/)
  assert.match(readFileSync('prototypes/campus3d/ui.js', 'utf8'), /data-school=/,
    'MY 내 정보에 학교 선택 버튼이 없습니다')
})

test('최근 원본 GLB 네 캐릭터만 월드 NPC와 알 상점에 노출한다', () => {
  for (const [ko, file] of [['거북이','turtle'],['기린','giraffe'],['펭귄','penguin'],['개구리','frog']]) {
    assert.match(chars, new RegExp(`${ko}: '${file}'`), `${ko} GLB 연결`)
    assert.match(chars, new RegExp(`${ko}:\\s*\\{\\s*skin:`), `${ko} 절차형 대체 모델`)
    assert.match(npcs, new RegExp(`species: '${ko}'`), `${ko} 월드 NPC`)
  }
  for (const ko of ['알파카','햄스터','고슴도치','백조']) {
    assert.doesNotMatch(npcs, new RegExp(`species: '${ko}'`), `${ko} 임의 NPC가 남았습니다`)
  }
  assert.match(world, /const SPEC = \['거북이', '기린', '펭귄', '개구리'\]/)
  assert.match(world, /allSp: SPEC/)
  assert.match(world, /dressPreview\(stage, \{/)
  assert.match(world, /wearPreviewHandle\?\.tryOn\(WEAR_TRY\)/)
})

test('자연스러운 1인칭 감쇠와 NPC 월드·사람 충돌을 유지한다', () => {
  assert.match(world, /fpYaw = smoothAngle\(fpYaw, yaw, follow\)/)
  assert.match(world, /const wantBob = Math\.sin\(P\.walk/)
  assert.match(world, /hitCampus\(x, z\)/)
  assert.match(world, /Math\.hypot\(x - m\.rig\.position\.x, z - m\.rig\.position\.z\) < \.92/)
  assert.match(world, /n\.rig\.position\.y = groundAt/)
})

test('DESKFIT 클레이 로딩 화면은 실제 캐릭터 자산과 진행 상태를 보여 준다', () => {
  assert.match(world, /class="load-brand">DESKFIT/)
  for (const file of ['turtle','giraffe','penguin','frog'])
    assert.match(world, new RegExp(`char-${file}-cut\\.webp`), `${file} 로딩 캐릭터`)
  assert.match(world, /class="load-track"/)
})

test('과잠은 선택 학교 대표색으로 실제 캐릭터에도 렌더된다', () => {
  const school = 0x862633
  const out = wearShop({
    wear: WEAR, owned: [], coins: 999, category: 'top', schoolColor: school,
    rides: [], ownedRide: [], onCategory() {}, onBuy() {},
  }).html
  assert.match(out, /data-wear-art="varsity"/, '과잠 3D 카드')
  assert.match(world, /color: b\.dataset\.buy === 'varsity' \? sc\?\.c : undefined/,
    '과잠 3D 카드에 학교 대표색을 전달하지 않습니다')
  assert.match(chars, /export const BARE = false/, '월드 캐릭터 옷 렌더가 강제로 꺼져 있습니다')
  assert.match(chars, /const bodyTop = top;/, '과잠 몸판이 저장된 대표색 재질을 쓰지 않습니다')
  assert.match(chars, /const upper = new THREE\.Mesh[\s\S]*?bodyTop\)/,
    '실제 캐릭터 상의 메시가 대표색 재질을 쓰지 않습니다')
  assert.match(world, /if \(sc && SAVE\.look\.topId === 'varsity'\) SAVE\.look\.top = sc\.c/,
    '선택 학교를 과잠 색 값에 반영하지 않습니다')
})

test('해상도를 프레임 저하 때 0.75로 낮추지 않고 기기 DPR을 유지한다', () => {
  assert.match(world, /const WORLD_DPR = Math\.min\(devicePixelRatio \|\| 1, 2\)/)
  assert.doesNotMatch(world, /setPixelRatio\((?:\.75|quality|WORLD_DPR\s*\*)/,
    '실행 중 월드 DPR을 낮추는 코드가 남아 있습니다')
})

test('NPC는 기능 구역과 물리적으로 겹치지 않고 기능·좌석이 E 우선이다', () => {
  for (const [room, list] of Object.entries(SPOTS)) for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j]
      const d = Math.hypot(a.x - b.x, a.z - b.z)
      assert.ok(d >= a.r + b.r + .14,
        `${room}/${a.title}과 ${b.title} E 구역이 겹칩니다 (${d.toFixed(2)})`)
    }
  }
  for (const [room, npcs] of Object.entries(INDOOR)) {
    for (const npc of npcs) for (const spot of (SPOTS[room] || [])) {
      const d = Math.hypot(npc.x - spot.x, npc.z - spot.z)
      assert.ok(d >= spot.r + 2.5,
        `${room}/${npc.name}이 ${spot.title} 상호작용 반경과 겹칩니다 (${d.toFixed(2)})`)
    }
  }
  assert.match(world, /if \(spot \|\| chairNear\) npcNear = null/)
  assert.match(world, /if \(room && npcNear && !near && !spot && !chairNear\)/)
})

test('삭제한 목 재기와 중앙 세션 구역은 없고 모든 방 출구가 보인다', () => {
  assert.doesNotMatch(spots, /giraffeNeck|기린 목 재기|기린 목 펴기/)
  const library = spots.slice(spots.indexOf('library: ['), spots.indexOf('mainhall: ['))
  assert.doesNotMatch(library, /(?:game|panel):\s*'(?:posture|retro)'|title:\s*'조용한 자리'/)
  assert.equal((rooms.match(/R\.exitSign\(/g) || []).length, 6, '실내 여섯 곳 출구 표지 수')
})

test('미니게임관에서 2048 기계와 상호작용을 모두 삭제했다', () => {
  const arcade = spots.slice(spots.indexOf('arcade: ['), spots.indexOf('shop: ['))
  assert.doesNotMatch(arcade, /2048|n2048/)
  assert.doesNotMatch(rooms, /\[-8\.0, -3\.6, 3\.6, 8\.0\]/)
  assert.match(rooms, /\[-6\.4, 0, 6\.4\]\.forEach/)
  assert.doesNotMatch(games, /n2048|2048-logic/, '2048 규칙이 번들에 남아 있습니다')
})

test('광장 달리기 시합은 장소와 게임 규칙에서 모두 삭제했다', () => {
  assert.doesNotMatch(spots, /trackRace|달리기 시합 100m|출발선/)
  assert.doesNotMatch(games, /trackRace|달리기 시합 100m/)
})

test('내 캐릭터는 상단 정보줄, 다른 사용자는 머리 위 3줄을 쓴다', () => {
  assert.match(world, /el\.className = 'tag3 peer'/)
  assert.match(world, /<b>\$\{esc3\(p\.nick/)
  assert.match(world, /<small>\$\{esc3\(p\.school/)
  assert.match(world, /<em>\$\{Math\.floor\(sec \/ 60\)/)
  assert.match(world, /idbarTime\(SESS\.t\)/)
})

test('기상청 키는 서버 환경변수이며 APIHub 승인 오류도 정확히 알린다', () => {
  assert.match(weatherApi, /process\.env\.KMA_SERVICE_KEY/)
  assert.match(weatherApi, /kma_sfctm2\.php/)
  assert.match(weatherApi, /종관기상관측\(ASOS\) API 활용신청이 필요합니다/)
  assert.doesNotMatch(weatherApi, /authKey:\s*['"][^'"]+['"]/, 'API 키가 소스에 들어갔습니다')
})

test('기숙사 일정 관리는 cid 개인 캘린더를 읽고 Google 본 화면으로 연다', () => {
  const link = 'https://calendar.google.com/calendar/u/0?cid=c3VoeXVua2ltMTEwNUBnbWFpbC5jb20'
  assert.equal(calendarEmbed(link),
    'https://calendar.google.com/calendar/embed?ctz=Asia%2FSeoul&mode=AGENDA&src=suhyunkim1105%40gmail.com')
  assert.equal(calendarOpenLink(link), link)
  const ui = readFileSync('prototypes/campus3d/ui.js', 'utf8')
  assert.match(ui, /Google Calendar에서 직접 열기/)
  assert.match(ui, /loading="eager"/)
  assert.match(ui, /다시 불러오기/)
  assert.match(ui, /12000/)
  assert.doesNotMatch(ui, /\.catch\(\(\) => fail\(/,
    '첫 네트워크 probe 실패만으로 캘린더를 제거합니다')
  assert.doesNotMatch(ui, /href="\$\{esc\(src\)\}" target="_blank"/,
    '새 탭에서도 차단되는 embed 주소를 다시 열고 있습니다')
})

test('지도 전체 클릭 이동·큰 핵심 건물·막히지 않은 본관 문을 유지한다', () => {
  assert.match(world, /function drawClayCampus\(g\)/, '3D 클레이 지도 렌더가 없습니다')
  assert.match(world, /function clayRoad\(g, pts, w = 18\)/, '지도에 입체 캠퍼스 도로망이 없습니다')
  assert.match(world, /function clayCrosswalk\(g, x, z, along = 'x'\)/, '지도에 횡단보도가 없습니다')
  assert.match(world, /const MAP_BLOCKS=\[/, '지도에 캠퍼스 블록이 없습니다')
  assert.match(world, /b\.zone==='arcade'/, '시설별 지붕·차양 실루엣이 없습니다')
  assert.match(world, /건물·도로·잔디 어디든 눌러 이동/, '지도 전체 이동 안내가 없습니다')
  assert.match(world, /const w = clayWorld\(px, py\)/, '지도 빈 곳 좌표를 월드 좌표로 바꾸지 않습니다')
  assert.match(world, /if \(!hitCampus\(x,z\)\) \{ at=\{x,z\}; break; \}/,
    '지도에서 막힌 곳을 눌렀을 때 가까운 빈 자리를 찾지 않습니다')
  assert.match(world, /\{ key: 'field', name: '운동장'/)
  assert.match(world, /\{ key: 'lake', name: '호수'/)
  assert.match(plan, /enter:\s*'arcade'[^\n]*?s:\s*3\.0/)
  assert.match(plan, /enter:\s*'shop'[^\n]*?s:\s*3\.0/)
  assert.match(plan, /enter:\s*'dorm'[^\n]*?s:\s*2\.7/)
  assert.match(buildings, /\[-5\.25, -3\.75, 3\.75, 5\.25\]/,
    '본관 출입문 앞 기둥을 비운 배치가 아닙니다')
})

test('전체 배치도의 25개 건물 본체가 서로 관통하지 않는다', () => {
  const rows = plan.split('\n').filter((line) => line.includes("{ n: '") && line.includes(' x:'))
  const val = (line, re, fallback = 0) => +(line.match(re)?.[1] ?? fallback)
  const faceAngle = { N: 0, S: 0, E: Math.PI / 2, W: Math.PI / 2,
    NE: Math.PI / 4, SW: Math.PI / 4, NW: -Math.PI / 4, SE: -Math.PI / 4 }
  const all = rows.map((line) => ({
    name: line.match(/\{ n: '([^']+)'/)?.[1], x: val(line, /x:\s*(-?[\d.]+)/), z: val(line, /z:\s*(-?[\d.]+)/),
    face: line.match(/face: '([^']+)'/)?.[1], w: val(line, /w:\s*([\d.]+)/), d: val(line, /d:\s*([\d.]+)/), s: val(line, /s:\s*([\d.]+)/, 1),
  }))
  assert.equal(all.length, 25, '배치도의 모든 건물을 검사하지 못했습니다')
  const overlaps = (a, b) => {
    const aa = faceAngle[a.face] || 0, ba = faceAngle[b.face] || 0
    const axes = [[Math.cos(aa), Math.sin(aa)],[-Math.sin(aa), Math.cos(aa)],
      [Math.cos(ba), Math.sin(ba)],[-Math.sin(ba), Math.cos(ba)]]
    for (const [ux, uz] of axes) {
      const radius = (q, ang) => Math.abs(ux * Math.cos(ang) + uz * Math.sin(ang)) * q.w * q.s / 2
        + Math.abs(ux * -Math.sin(ang) + uz * Math.cos(ang)) * q.d * q.s / 2
      const distance = Math.abs((b.x - a.x) * ux + (b.z - a.z) * uz)
      if (distance >= radius(a, aa) + radius(b, ba) - .05) return false
    }
    return true
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
    assert.equal(overlaps(all[i], all[j]), false, `${all[i].name}과 ${all[j].name} 건물이 겹칩니다`)
})

test('동아리 상점 정면 매대가 건물이나 서로를 관통하지 않는다', () => {
  assert.match(buildings, /\[\[-3\.2, \.0\], \[-3\.2, 1\.14\]\]/,
    '정면 매대 두 상자의 깊이 간격이 다시 겹쳤습니다')
  const wallFront = 5.2 / 2
  const firstCentre = wallFront + 1.0
  const secondCentre = wallFront + 1.0 + 1.14
  const depth = 1.0
  assert.ok(firstCentre - depth / 2 > wallFront, '첫 매대가 건물 외벽을 관통합니다')
  assert.ok(secondCentre - firstCentre > depth, '매대 두 상자가 서로 관통합니다')
})

test('표현 여덟 개가 각각 별도 캐릭터 모션을 가진다', () => {
  assert.match(chars, /glb:\s*\{[^}]*body[^}]*poseNodes/, '원본 GLB 표현용 뼈대가 저장되지 않았습니다')
  assert.match(emote, /if \(P\.glb\?\.poseNodes\)/, '원본 GLB 표현 모션 경로가 없습니다')
  for (const key of ['wave', 'clap', 'yes', 'no', 'jump', 'dance', 'sad', 'love']) {
    assert.match(emote, new RegExp(`\\{ k: '${key}'`), `${key} 표현 정의`)
    assert.match(emote, new RegExp(`case '${key}':`), `${key} 캐릭터 모션`)
  }
})

test('최신 GLB 캐릭터도 실제 옷과 앉은 자세를 적용한다', () => {
  assert.match(chars, /addGlbWear\(g, species, fit\)/, 'GLB 캐릭터에 착용 레이어가 연결되지 않았습니다')
  assert.match(chars, /equipped-clay-outfit/, '착용한 옷의 3D 그룹이 없습니다')
  for (const species of ['거북이', '기린', '펭귄', '개구리'])
    assert.match(chars, new RegExp(`'${species}':\\s*\\{ top:`), `${species} 원본 체형별 옷 맞춤값이 없습니다`)
  assert.doesNotMatch(chars, /wide, \.68, \.68/,
    '원본 체형을 무시한 큰 구형 상의가 다시 캐릭터 몸을 덮습니다')
  assert.match(chars, /if \(L\.glassesId && L\.glassesId !== 'none'\)/,
    '원본 네 캐릭터의 안경 착용 경로가 없습니다')
  assert.match(chars, /g\.userData\.outfitAudit/, '플레이어·NPC 착용 상태를 교차 검수할 정보가 없습니다')
  assert.match(chars, /G\.body\.position\.y = G\.bodyY - \.31/, '앉을 때 몸을 좌판 높이로 내리지 않습니다')
  assert.match(chars, /tilt\('leg\.L', -1\.18/, '앉을 때 다리를 굽히지 않습니다')
})

test('첫 안내는 아이콘·제목·본문을 한 축으로 정렬한다', () => {
  const out = tour({ step: 0, onStep() {}, onDone() {} }).html
  assert.match(out, /class="cc tour-card"/)
  assert.match(out, /class="ic sky tour-icon"/)
  assert.match(out, /class="tour-title">섬 하나가 캠퍼스예요/)
  assert.match(out, /class="tour-copy">건물 여섯 채/)
  assert.match(world, /\.tour-card\{[^}]*align-items:center[^}]*justify-content:center[^}]*text-align:center/)
  assert.match(world, /\.tour-card \.tour-copy\{[^}]*width:min\(100%,660px\)[^}]*margin:0 auto/)
})

test('광장 이정표를 없애고 본관 현우를 시설 안내 NPC로 둔다', () => {
  const campus = spots.slice(spots.indexOf('campus: ['), spots.indexOf('library: ['))
  assert.doesNotMatch(campus, /이정표/)
  const hyunwoo = INDOOR.mainhall.find((npc) => npc.name === '현우')
  assert.equal(hyunwoo?.role, '본관 학과 조교')
  assert.ok(hyunwoo?.lines.some((line) => line.includes('오늘 강의')))
  assert.ok(hyunwoo?.lines.some((line) => line.includes('강단 스피커')))
  assert.ok(hyunwoo?.lines.some((line) => line.includes('자세 세션')))
})

test('도서관 대출대·반납 수레·은지 안내가 출입문과 서로 겹치지 않는다', () => {
  const library = rooms.slice(rooms.indexOf('library(g) {'), rooms.indexOf('mainhall(g) {'))
  assert.match(library, /R\.globe\(g, -10\.2, 1\.08, 14\.2\)/, '지구본이 대출대 상판 안쪽이 아닙니다')
  assert.match(library, /R\.bookCart\(g, 5\.0, 12\.2, 0\)/)
  assert.match(library, /R\.bookCart\(g, 6\.6, 12\.2, 0\)/)
  assert.doesNotMatch(library, /R\.(?:bin|plant|mag|aFrame)\(g/, '도서관의 쓰레기통·화분·겹친 안내물이 남았습니다')
  assert.doesNotMatch(library, /\[-13\.4, 13\.4\]|\[13\.4, 13\.4\]/,
    '대출대와 겹치던 맨 앞 열람 책상이 남았습니다')
  const cart = SPOTS.library.find((s) => s.game === 'bookSort')
  assert.deepEqual([cart?.x, cart?.z, cart?.r], [5.8, 12.2, 1.8])
  const eunji = INDOOR.library.find((npc) => npc.name === '은지')
  assert.equal(eunji?.role, '도서관 사서')
  assert.deepEqual([eunji?.x, eunji?.z, eunji?.dir], [-8, 15.45, Math.PI])
  assert.ok(eunji?.lines.some((line) => line.includes('자세 세션')))
  assert.ok(eunji?.lines.some((line) => line.includes('책 정리 미니게임')))
  assert.ok(Math.hypot(eunji.x - cart.x, eunji.z - cart.z) >= cart.r + 2.5)
})

test('앉은 GLB 상체는 기울이지 않고 다리만 접는다', () => {
  assert.doesNotMatch(chars, /tilt\('(root|spine|head)'/)
  assert.match(chars, /tilt\('leg\.L', -1\.18, -\.08\)/)
  assert.match(chars, /tilt\('leg\.R', -1\.18, \.08\)/)
})

test('학생회관 라운지·식당과 학교 설정 안내를 분리한다', () => {
  const union = rooms.slice(rooms.indexOf('union(g) {'), rooms.indexOf('arcade(g) {'))
  assert.doesNotMatch(union, /R\.window3\(g, 9\.6,/, '식당 메뉴판 뒤에 겹친 창이 남았습니다')
  assert.match(union, /\[\[8\.2, \.8, 0xF2C14E\], \[8\.2, 5\.2, 0xE8935A\]\]/)
  assert.doesNotMatch(union, /\[-8\.2, (?:1\.0|5\.6),/, '라운지와 겹치던 왼쪽 식탁이 남았습니다')
  assert.match(readFileSync('prototypes/campus3d/room.js', 'utf8'), /const inward = Math\.atan2\(-Math\.cos\(a\), -Math\.sin\(a\)\);[\s\S]*?c\.rotation\.y = inward/)
  const empty = cafeteria({ school: '', data: undefined }).html
  assert.match(empty, /MY의 내 정보에서 학교를 고르면/)
  assert.doesNotMatch(empty, /옷장\(C\)/)
})

test('넓어진 E 기능 구역은 서로와 NPC를 교차하지 않는다', () => {
  const extra = .65
  for (const [room, list] of Object.entries(SPOTS)) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j]
      const d = Math.hypot(a.x - b.x, a.z - b.z)
      assert.ok(d >= a.r + b.r + extra * 2 + .1,
        `${room}/${a.title}과 ${b.title}의 넓힌 E 구역이 겹칩니다 (${d.toFixed(2)})`)
    }
    for (const npc of INDOOR[room] || []) for (const spot of list) {
      const d = Math.hypot(npc.x - spot.x, npc.z - spot.z)
      assert.ok(d >= spot.r + extra + 2.5,
        `${room}/${npc.name}이 넓힌 ${spot.title} 구역을 가로챕니다 (${d.toFixed(2)})`)
    }
  }
  assert.match(world, /const spotReach = \(s\) => \(s\.r \|\| 1\) \+ \.65/)
  assert.match(world, /function nearSeat\(\)/)
  assert.match(world, /let best = null, bd = 2\.15 \* 2\.15/)
})

test('기숙사는 작은 안내·일정 창, 창가 날씨, 빈백 앉기와 침대 눕기를 쓴다', () => {
  const room = readFileSync('prototypes/campus3d/room.js', 'utf8')
  const ui = readFileSync('prototypes/campus3d/ui.js', 'utf8')
  assert.match(ui, /export function schedule[\s\S]*?medium: true/)
  assert.match(ui, /export function dormInfo[\s\S]*?medium: true/)
  assert.match(world, /\.dorm-info-view \.cc\{[^}]*align-items:center[^}]*text-align:center/)
  assert.match(world, /case 'weather': return weatherView\(\)/)
  assert.match(room, /regSeatLocal\(x, z, ry, 0, 1\.18, 'bed'\)/)
  assert.match(room, /regSeatLocal\(x, z, ry, 0, \.14, 'beanbag'\)/)
  assert.match(world, /if \(q\.kind === 'bed'\) \{[\s\S]*?lie\(player, true\)/)
  assert.match(world, /const drop = q\.kind === 'beanbag' \? \.18 : 0/)
  assert.deepEqual(INDOOR.dorm, [], '기숙사 하연 NPC가 남았습니다')
})

test('동아리 상점 가구 구역은 독립 쇼룸이며 출입문과 다른 상점을 침범하지 않는다', () => {
  const shop = rooms.slice(rooms.indexOf('shop(g) {'))
  const room = readFileSync('prototypes/campus3d/room.js', 'utf8')
  const showroom = room.slice(room.indexOf('export function furnitureShowroom'), room.indexOf('/** 긴 벤치'))
  assert.match(shop, /R\.furnitureShowroom\(g, -8\.4, 4\.15, 0\)/)
  assert.doesNotMatch(shop, /R\.sofa\(g, -10\.35, 4\.15/)
  assert.doesNotMatch(shop, /R\.lowTable\(g, -8\.35, 4\.15/)
  assert.doesNotMatch(shop, /R\.displayTable\(g, -6\.55, 2\.05/)
  assert.match(showroom, /p\.name = 'furnitureShowroom'/)
  assert.match(showroom, /소재 라이브러리 벽/)
  assert.match(showroom, /sampleSofa\(/)
  assert.match(showroom, /수납 코너/)
  assert.doesNotMatch(showroom, /regSeat/, '판매용 진열 가구가 앉기 기능을 가로챕니다')
  assert.doesNotMatch(shop, /R\.rug\(g, 0, 3\.3, 18\.8/,
    '가구 구역이 출입문과 다른 상점을 가로지르는 옛 대형 러그입니다')
  const furniture = SPOTS.shop.find((s) => s.panel === 'furn-shop')
  const wear = SPOTS.shop.find((s) => s.panel === 'wear-shop')
  const egg = SPOTS.shop.find((s) => s.panel === 'egg-shop')
  assert.deepEqual([furniture.x, furniture.z, furniture.r], [-8.2, 3.55, 2.75])
  for (const other of [wear, egg])
    assert.ok(Math.hypot(furniture.x - other.x, furniture.z - other.z) >= furniture.r + other.r + 1.3)
})

test('짝 맞추기·셋 지우기·러너의 커서는 게임보다 위에서 함께 동기화된다', () => {
  assert.match(world, /#gcur\{position:fixed;[^}]*z-index:400/)
  assert.match(world, /document\.body\.appendChild\(curEl\(\)\)/)
  assert.match(world, /addEventListener\('campus:game-state'/)
  assert.match(world, /classList\.remove\('look', 'press'\)/)
  assert.match(world, /function uiOpen\(\) \{ return panelOn \|\| dlgOn \|\| mapOn \|\| gameOpen\(\); \}/)
  assert.match(games, /function announceGameState\(open\)/)
  assert.match(games, /announceGameState\(true\)/)
  assert.match(games, /announceGameState\(false\)/)
})

test('동물 러너는 누락된 외부 런타임 없이 로컬 Canvas 엔진으로 열린다', () => {
  const runner = readFileSync('prototypes/openworld/animal-runner-game.mjs', 'utf8')
  const engine = readFileSync('prototypes/openworld/animal-runner-engine.mjs', 'utf8')
  assert.match(games, /import\('\.\.\/openworld\/animal-runner-game\.mjs'\)/)
  assert.match(runner, /export function mountAnimalRunner/)
  assert.match(runner, /document\.createElement\('canvas'\)/)
  assert.doesNotMatch(runner, /Phaser|phaser/)
  assert.match(engine, /export const RUNNER_CONFIG/)
  assert.match(engine, /export function createRunnerState/)
})
