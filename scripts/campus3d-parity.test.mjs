import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const oldWorld = readFileSync('prototypes/openworld/index.html', 'utf8')
const games = readFileSync('prototypes/campus3d/games.js', 'utf8')
const spots = readFileSync('prototypes/campus3d/spots.js', 'utf8')
const world3d = readFileSync('prototypes/campus3d/index.html', 'utf8')

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

  assert.ok(oldKeys.length >= 8, '2D 미니게임 목록을 충분히 읽지 못했습니다')
  for (const oldKey of oldKeys) {
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
    animalRunner: ['game', 'run'], eggMerge: ['game', 'eggMerge'],
    giraffeNeck: ['game', 'giraffeNeck'], animalMatch3: ['game', 'match3'],
    aboutLibrary: ['room', 'library'], aboutMainhall: ['room', 'mainhall'],
    aboutUnion: ['room', 'union'], arcade: ['room', 'arcade'],
    guide: ['panel', 'guide'], privacy: ['panel', 'privacy'], retro: ['panel', 'retro'],
    hall: ['panel', 'fame'], market: ['panel', 'wear-shop'], coins: ['panel', 'coins'],
    settings: ['panel', 'mypage'],
  }

  assert.deepEqual(oldKeys.filter((key) => !parity[key]), [], '대응표에 없는 2D 패널이 생겼습니다')
  for (const [oldKey, [kind, key]] of Object.entries(parity)) {
    const source = kind === 'game' ? games + spots : kind === 'panel' ? world3d + spots : world3d
    const needle = kind === 'game' ? new RegExp(`(?:\\b${key}:\\s*\\{|game:\\s*'${key}')`)
      : kind === 'panel' ? new RegExp(`(?:case\\s+'${key}'|panel:\\s*'${key}')`)
        : new RegExp(`['\"]${key}['\"]`)
    assert.match(source, needle, `${oldKey}의 3D 대응 기능(${key})이 끊겼습니다`)
  }
})
