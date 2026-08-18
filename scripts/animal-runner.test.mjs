import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('prototypes/openworld/index.html', 'utf8')

test('the former escape-room gate is wired to animal runner', () => {
  assert.match(html, /name: '동물 달리기', panel: 'animalRunner'/)
  assert.match(html, /gateCanvas\('gateEsc', '동물 달리기'/)
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
