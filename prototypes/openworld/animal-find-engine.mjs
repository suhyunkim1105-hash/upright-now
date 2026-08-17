export const ANIMAL_MEMORY_TYPES = [
  { id: 'turtle', name: '거북이', emoji: '🐢', color: '#79c98b' },
  { id: 'giraffe', name: '기린', emoji: '🦒', color: '#f4c95d' },
  { id: 'penguin', name: '펭귄', emoji: '🐧', color: '#8ec9e8' },
  { id: 'hamster', name: '햄스터', emoji: '🐹', color: '#e5ae86' },
  { id: 'frog', name: '개구리', emoji: '🐸', color: '#83c96d' },
  { id: 'hedgehog', name: '고슴도치', emoji: '🦔', color: '#c79873' },
  { id: 'alpaca', name: '알파카', emoji: '🦙', color: '#ead9bd' },
  { id: 'swan', name: '백조', emoji: '🦢', color: '#c7d9ef' },
]

export const ANIMAL_MEMORY_CONFIG = {
  previewDurationMs: 2000,
  mismatchDelayMs: 700,
  baseMatchScore: 100,
  comboBonusStep: 20,
  maxComboBonus: 3,
}

function shuffle(items, rng) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.min(index, Math.floor(rng() * (index + 1)))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

function createCards(rng) {
  const cards = ANIMAL_MEMORY_TYPES.flatMap((animal) => [0, 1].map((copy) => ({
    id: `${animal.id}-${copy}`,
    animalId: animal.id,
    isFlipped: true,
    isMatched: false,
  })))
  return shuffle(cards, rng)
}

export function createGame() {
  return {
    status: 'READY',
    cards: [],
    firstIndex: -1,
    secondIndex: -1,
    moves: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    matchedPairs: 0,
    previewEndsAt: 0,
    startedAt: null,
    playStartedAt: null,
  }
}

export function startGame(state, now = 0, rng = Math.random) {
  state.status = 'PREVIEW'
  state.cards = createCards(rng)
  state.firstIndex = -1
  state.secondIndex = -1
  state.moves = 0
  state.score = 0
  state.combo = 0
  state.maxCombo = 0
  state.matchedPairs = 0
  state.startedAt = now
  state.playStartedAt = null
  state.previewEndsAt = now + ANIMAL_MEMORY_CONFIG.previewDurationMs
  return state
}

export function tickGame(state, now) {
  if (state.status !== 'PREVIEW' || now < state.previewEndsAt) return state
  state.status = 'PLAYING'
  state.playStartedAt = now
  for (const card of state.cards) card.isFlipped = false
  return state
}

export function selectCard(state, index) {
  if (state.status !== 'PLAYING') return { accepted: false, reason: state.status }
  if (!Number.isInteger(index) || !state.cards[index]) return { accepted: false, reason: 'INVALID' }
  const card = state.cards[index]
  if (card.isMatched) return { accepted: false, reason: 'MATCHED' }
  if (index === state.firstIndex) return { accepted: false, reason: 'DUPLICATE' }
  if (state.firstIndex < 0) {
    state.firstIndex = index
    card.isFlipped = true
    return { accepted: true, index }
  }
  state.secondIndex = index
  card.isFlipped = true
  state.moves += 1
  state.status = 'CHECKING'
  return { accepted: true, index, checking: true }
}

export function resolvePendingPair(state) {
  if (state.status !== 'CHECKING') return { resolved: false, reason: state.status }
  const first = state.cards[state.firstIndex]
  const second = state.cards[state.secondIndex]
  if (!first || !second) return { resolved: false, reason: 'INVALID_PAIR' }
  const matched = first.animalId === second.animalId
  if (matched) {
    first.isMatched = true
    second.isMatched = true
    state.matchedPairs += 1
    state.combo += 1
    state.maxCombo = Math.max(state.maxCombo, state.combo)
    const comboBonus = Math.min(state.combo - 1, ANIMAL_MEMORY_CONFIG.maxComboBonus) * ANIMAL_MEMORY_CONFIG.comboBonusStep
    state.score += ANIMAL_MEMORY_CONFIG.baseMatchScore + comboBonus
  } else {
    first.isFlipped = false
    second.isFlipped = false
    state.combo = 0
  }
  state.firstIndex = -1
  state.secondIndex = -1
  state.status = isGameComplete(state) ? 'GAME_OVER' : 'PLAYING'
  return { resolved: true, matched, complete: state.status === 'GAME_OVER' }
}

export function isGameComplete(state) {
  return state.matchedPairs >= ANIMAL_MEMORY_TYPES.length
}
