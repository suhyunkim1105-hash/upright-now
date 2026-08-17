import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ANIMAL_MEMORY_CONFIG,
  ANIMAL_MEMORY_TYPES,
  createGame,
  isGameComplete,
  resolvePendingPair,
  selectCard,
  startGame,
  tickGame,
} from '../prototypes/openworld/animal-find-engine.mjs'

function countByAnimal(cards) {
  return cards.reduce((counts, card) => {
    counts[card.animalId] = (counts[card.animalId] || 0) + 1
    return counts
  }, {})
}

function beginPlaying(rng = () => 0.1) {
  const state = startGame(createGame(), 0, rng)
  tickGame(state, ANIMAL_MEMORY_CONFIG.previewDurationMs)
  return state
}

test('starts with 16 revealed cards and two cards for each animal', () => {
  const state = startGame(createGame(), 1000, () => 0.1)
  assert.equal(ANIMAL_MEMORY_TYPES.length, 8)
  assert.equal(state.cards.length, 16)
  assert.deepEqual(Object.values(countByAnimal(state.cards)).sort((a, b) => a - b), Array(8).fill(2))
  assert.equal(state.status, 'PREVIEW')
  assert.equal(state.cards.every((card) => card.isFlipped), true)
  assert.equal(state.playStartedAt, null)
})

test('preview locks card selection until its duration expires', () => {
  const state = startGame(createGame(), 500, () => 0.2)
  assert.deepEqual(selectCard(state, 0), { accepted: false, reason: 'PREVIEW' })
  tickGame(state, 500 + ANIMAL_MEMORY_CONFIG.previewDurationMs - 1)
  assert.equal(state.status, 'PREVIEW')
  tickGame(state, 500 + ANIMAL_MEMORY_CONFIG.previewDurationMs)
  assert.equal(state.status, 'PLAYING')
  assert.equal(state.playStartedAt, 500 + ANIMAL_MEMORY_CONFIG.previewDurationMs)
  assert.equal(state.cards.every((card) => !card.isFlipped), true)
})

test('selects two cards, increments Move, and enters CHECKING', () => {
  const state = beginPlaying()
  assert.deepEqual(selectCard(state, 0), { accepted: true, index: 0 })
  assert.deepEqual(selectCard(state, 1), { accepted: true, index: 1, checking: true })
  assert.equal(state.status, 'CHECKING')
  assert.equal(state.moves, 1)
  assert.equal(state.cards[0].isFlipped, true)
  assert.equal(state.cards[1].isFlipped, true)
})

test('rejects duplicate, matched, and third-card input while checking', () => {
  const state = beginPlaying()
  selectCard(state, 0)
  assert.deepEqual(selectCard(state, 0), { accepted: false, reason: 'DUPLICATE' })
  selectCard(state, 1)
  assert.deepEqual(selectCard(state, 2), { accepted: false, reason: 'CHECKING' })
  resolvePendingPair(state)
  assert.equal(state.cards.some((card) => card.isMatched), false)
  state.cards[0].isMatched = true
  assert.deepEqual(selectCard(state, 0), { accepted: false, reason: 'MATCHED' })
})

test('matching cards stay open and add score and combo', () => {
  const state = beginPlaying()
  const pair = state.cards.reduce((indices, card, index) => {
    if (indices.length < 2 && card.animalId === state.cards[0].animalId) indices.push(index)
    return indices
  }, [])
  selectCard(state, pair[0])
  selectCard(state, pair[1])
  const result = resolvePendingPair(state)
  assert.equal(result.matched, true)
  assert.equal(state.status, 'PLAYING')
  assert.equal(state.combo, 1)
  assert.equal(state.score, 100)
  assert.equal(state.matchedPairs, 1)
  assert.equal(state.cards[pair[0]].isMatched, true)
  assert.equal(state.cards[pair[1]].isMatched, true)
})

test('mismatching cards reset after resolution and clear combo', () => {
  const state = beginPlaying()
  state.combo = 3
  const first = 0
  const second = state.cards.findIndex((card, index) => index > first && card.animalId !== state.cards[first].animalId)
  selectCard(state, first)
  selectCard(state, second)
  const result = resolvePendingPair(state)
  assert.equal(result.matched, false)
  assert.equal(state.status, 'PLAYING')
  assert.equal(state.combo, 0)
  assert.equal(state.cards[first].isFlipped, false)
  assert.equal(state.cards[second].isFlipped, false)
})

test('completes after all eight pairs are matched and supports a clean restart', () => {
  const state = beginPlaying()
  for (let index = 0; index < state.cards.length; index += 1) {
    if (state.cards[index].isMatched) continue
    const pair = state.cards
      .map((card, cardIndex) => ({ card, cardIndex }))
      .filter(({ card, cardIndex }) => !card.isMatched && card.animalId === state.cards[index].animalId && cardIndex !== index)
      .map(({ cardIndex }) => cardIndex)
    selectCard(state, index)
    selectCard(state, pair[0])
    resolvePendingPair(state)
  }
  assert.equal(isGameComplete(state), true)
  assert.equal(state.status, 'GAME_OVER')
  assert.equal(state.matchedPairs, 8)
  const restarted = startGame(createGame(), 9000, () => 0.7)
  assert.equal(restarted.status, 'PREVIEW')
  assert.equal(restarted.moves, 0)
  assert.equal(restarted.score, 0)
  assert.equal(restarted.matchedPairs, 0)
})
