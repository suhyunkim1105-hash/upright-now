import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('prototypes/openworld/index.html', 'utf8')

test('the former escape-room gate is wired to animal runner', () => {
  assert.match(html, /name: '동물 달리기', panel: 'animalRunner'/)
  /* 관문 간판은 더 이상 gateCanvas 를 손으로 부르지 않습니다. 관문 넷이
     캠퍼스 마당에서 미니게임관 **안**으로 들어가면서(ZONES.arcade),
     이름·자리·색을 MINIGAMES 표 한 곳이 들고 paintGates 가 그 표를
     훑습니다. 그래서 "gateEsc 간판에 동물 달리기라고 쓰여 있다"는
     이제 표에서 확인합니다 — 아래 두 줄이 같은 것을 봅니다. */
  assert.match(html, /name: '동물 달리기', panel: 'animalRunner',[\s\S]{0,120}?prop: 'gateEsc'/)
  assert.match(html, /gateEsc:\s*\{[^}]*emblem: 'key'/)
  assert.match(html, /function animalRunnerHtml\(/)
  assert.match(html, /mountAnimalRunner\(/)
})

test('runner result and lifecycle are connected to the existing panel', () => {
  for (const token of [
    'onGameComplete',
    'ROOM.character',
    'GIRIN_CHAR.mine()',
    'gameReward(\'동물 달리기 성공\')',
    'animalRunnerInstance.destroy()',
    'RUN COMPLETE',
    '최종 점수',
    '획득 코인',
  ]) {
    assert.match(html, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('the retired game panels are no longer exposed from the map panel registry', () => {
  assert.doesNotMatch(html, /giraffeStack:\s*\(\)\s*=>/)
  assert.doesNotMatch(html, /escapeRoom:\s*\(\)\s*=>/)
  assert.doesNotMatch(html, /row\('escapeRoom'/)
})
