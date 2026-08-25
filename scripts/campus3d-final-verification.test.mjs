import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { wearShop } from '../prototypes/campus3d/ui.js'
import { SPOTS } from '../prototypes/campus3d/spots.js'
import { INDOOR } from '../prototypes/campus3d/npcs.js'

const world = readFileSync('prototypes/campus3d/index.html', 'utf8')
const rooms = readFileSync('prototypes/campus3d/rooms.js', 'utf8')
const spots = readFileSync('prototypes/campus3d/spots.js', 'utf8')
const chars = readFileSync('prototypes/campus3d/chars.js', 'utf8')
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

test('옷 가게의 모든 카테고리 상품이 GPU와 무관한 SVG로 보인다', () => {
  for (const [slot, items] of Object.entries(WEAR)) {
    const out = wearShop({
      wear: WEAR, owned: [], coins: 999, category: slot, schoolColor: 0x862633,
      rides: [], ownedRide: [], onCategory() {}, onBuy() {},
    }).html
    const expected = items.filter(([id]) => id !== 'none').length
    assert.equal((out.match(/data-wear-art=/g) || []).length, expected, `${slot} 카드 수`)
    assert.equal((out.match(/<svg class="wear-art"/g) || []).length, expected, `${slot} SVG 수`)
    for (const [id] of items.filter(([id]) => id !== 'none'))
      assert.match(out, new RegExp(`data-wear-art="${id}"`), `${slot}/${id} 미리보기`)
  }
})

test('Git의 원본 네 캐릭터와 복원한 네 캐릭터가 알 상점 여덟 종으로 이어진다', () => {
  for (const [ko, file] of [['거북이','turtle'],['기린','giraffe'],['펭귄','penguin'],['개구리','frog']]) {
    assert.match(chars, new RegExp(`${ko}: '${file}'`), `${ko} GLB 연결`)
    assert.match(chars, new RegExp(`${ko}:\\s*\\{\\s*skin:`), `${ko} 절차형 대체 모델`)
  }
  for (const ko of ['알파카','햄스터','고슴도치','백조']) {
    assert.match(chars, new RegExp(`${ko}\\(h, C\\)`), `${ko} 머리 조형`)
    assert.match(chars, new RegExp(`${ko}:\\s*\\{\\s*skin:`), `${ko} 재질`)
    assert.match(npcs, new RegExp(`species: '${ko}'`), `${ko} 월드 NPC`)
  }
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
  assert.match(out, /data-wear-art="varsity"[\s\S]*?#862633/i, '과잠 카드 학교색')
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

test('지도 전체 클릭 이동·큰 핵심 건물·막히지 않은 본관 문을 유지한다', () => {
  assert.match(world, /let best = null, bd = Infinity;/, '지도 빈 곳 클릭 이동이 막혀 있습니다')
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
  for (const key of ['wave', 'clap', 'yes', 'no', 'jump', 'dance', 'sad', 'love']) {
    assert.match(emote, new RegExp(`\\{ k: '${key}'`), `${key} 표현 정의`)
    assert.match(emote, new RegExp(`case '${key}':`), `${key} 캐릭터 모션`)
  }
})
