export const RUNNER_CONFIG = Object.freeze({
  gameDurationMs: 180_000,
  coinScore: 100,
  hitPenalty: 200,
  invincibleDurationMs: 1_000,
  baseSurvivalScorePerSecond: 10,
  difficultyStages: Object.freeze([
    { untilMs: 60_000, speedMultiplier: 1 },
    { untilMs: 120_000, speedMultiplier: 1.1 },
    { untilMs: Infinity, speedMultiplier: 1.2 },
  ]),
})

export function createRunnerState() {
  return {
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
  }
}

export function canJump(state) {
  return state.status === 'PLAYING' && !state.airborne
}

export function collectCoin(state, coinId) {
  if (state.status !== 'PLAYING' || state.collectedCoins.has(coinId)) return false
  state.collectedCoins.add(coinId)
  state.coins += 1
  state.combo += 1
  state.maxCombo = Math.max(state.maxCombo, state.combo)
  state.score += RUNNER_CONFIG.coinScore
  return true
}

export function hitObstacle(state, now) {
  if (state.status !== 'PLAYING' || now < state.invincibleUntil) return false
  state.hitCount += 1
  state.score -= RUNNER_CONFIG.hitPenalty
  state.combo = 0
  state.invincibleUntil = now + RUNNER_CONFIG.invincibleDurationMs
  return true
}

export function difficultyAt(elapsedMs) {
  const elapsed = Math.max(0, elapsedMs)
  return RUNNER_CONFIG.difficultyStages.find((stage) => elapsed < stage.untilMs)
    || RUNNER_CONFIG.difficultyStages.at(-1)
}

export function tickRunner(state, now) {
  if (state.status !== 'PLAYING' || state.startedAt === null) return state
  const elapsedMs = Math.max(0, now - state.startedAt)
  const cappedElapsedMs = Math.min(elapsedMs, RUNNER_CONFIG.gameDurationMs)
  const elapsedSeconds = Math.floor(cappedElapsedMs / 1000)
  const newSeconds = Math.max(0, elapsedSeconds - state.survivalScoreSeconds)
  state.score += newSeconds * RUNNER_CONFIG.baseSurvivalScorePerSecond
  state.survivalScoreSeconds = Math.max(state.survivalScoreSeconds, elapsedSeconds)
  return state
}

export function finishRunner(state, now) {
  if (state.status === 'GAME_OVER') return null
  const startedAt = state.startedAt ?? now
  state.status = 'GAME_OVER'
  state.endedAt = now
  return {
    score: state.score,
    coins: state.coins,
    hitCount: state.hitCount,
    maxCombo: state.maxCombo,
    playTime: Math.min(Math.max(0, now - startedAt), RUNNER_CONFIG.gameDurationMs),
  }
}
