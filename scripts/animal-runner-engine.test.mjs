import test from 'node:test'
import assert from 'node:assert/strict'

import {
  RUNNER_CONFIG,
  canJump,
  collectCoin,
  createRunnerState,
  difficultyAt,
  finishRunner,
  hitObstacle,
  tickRunner,
} from '../prototypes/openworld/animal-runner-engine.mjs'

test('new runner state starts ready with empty score counters', () => {
  assert.deepEqual(createRunnerState(), {
    status: 'READY',
    airborne: false,
    score: 0,
    coins: 0,
    hitCount: 0,
    combo: 0,
    maxCombo: 0,
    collectedCoins: new Set(),
    survivalScoreSeconds: 0,
    invincibleUntil: 0,
    startedAt: null,
    endedAt: null,
  })
})

test('jump is allowed on the ground but not while airborne', () => {
  const state = createRunnerState()
  state.status = 'PLAYING'
  assert.equal(canJump(state), true)
  state.airborne = true
  assert.equal(canJump(state), false)
})

test('collecting a coin is idempotent for the same coin id', () => {
  const state = createRunnerState()
  state.status = 'PLAYING'
  assert.equal(collectCoin(state, 'coin-1'), true)
  assert.equal(collectCoin(state, 'coin-1'), false)
  assert.equal(state.coins, 1)
  assert.equal(state.score, RUNNER_CONFIG.coinScore)
  assert.equal(state.combo, 1)
})

test('obstacle hit applies one penalty and blocks hits during invincibility', () => {
  const state = createRunnerState()
  state.status = 'PLAYING'
  assert.equal(hitObstacle(state, 1000), true)
  assert.equal(state.hitCount, 1)
  assert.equal(state.score, -RUNNER_CONFIG.hitPenalty)
  assert.equal(state.invincibleUntil, 1000 + RUNNER_CONFIG.invincibleDurationMs)
  assert.equal(hitObstacle(state, 1500), false)
  assert.equal(state.hitCount, 1)
})

test('runner speed increases at 60 and 120 seconds without exceeding the configured stages', () => {
  assert.equal(difficultyAt(0).speedMultiplier, 1)
  assert.equal(difficultyAt(59_999).speedMultiplier, 1)
  assert.equal(difficultyAt(60_000).speedMultiplier, 1.1)
  assert.equal(difficultyAt(120_000).speedMultiplier, 1.2)
})

test('finish returns one capped result for the 180 second session', () => {
  const state = createRunnerState()
  state.status = 'PLAYING'
  state.startedAt = 0
  state.score = 1250
  state.coins = 8
  state.hitCount = 2
  state.maxCombo = 4

  const result = finishRunner(state, RUNNER_CONFIG.gameDurationMs + 5000)
  assert.equal(state.status, 'GAME_OVER')
  assert.deepEqual(result, {
    score: 1250,
    coins: 8,
    hitCount: 2,
    maxCombo: 4,
    playTime: RUNNER_CONFIG.gameDurationMs,
  })
  assert.equal(finishRunner(state, RUNNER_CONFIG.gameDurationMs + 6000), null)
})

test('tick adds each elapsed survival second only once', () => {
  const state = createRunnerState()
  state.status = 'PLAYING'
  state.startedAt = 0
  tickRunner(state, 2_500)
  assert.equal(state.score, 20)
  tickRunner(state, 2_900)
  assert.equal(state.score, 20)
  tickRunner(state, 3_100)
  assert.equal(state.score, 30)
})
