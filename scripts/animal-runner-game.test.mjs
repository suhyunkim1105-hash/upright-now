import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('prototypes/openworld/animal-runner-game.mjs', 'utf8')

test('runner module exposes a mountable game lifecycle', () => {
  assert.match(source, /export function mountAnimalRunner\(/)
  assert.match(source, /return \{ restart, destroy \}/)
  assert.match(source, /new Phaser\.Game\(/)
  assert.match(source, /class RunnerScene extends Phaser\.Scene/)
})

test('runner module wires the required gameplay and input contracts', () => {
  for (const token of [
    'RUNNER_CONFIG.gameDurationMs',
    'onGameComplete',
    'collectCoin',
    'hitObstacle',
    'finishRunner',
    'createMobileControls',
    'left',
    'right',
    'jump',
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(source, /this\.context\.onGameComplete\(result\)/)
})
