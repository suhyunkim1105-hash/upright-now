import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BOARD_SIZE,
  ACTIVE_TYPES,
  createBoard,
  findMatches,
  isAdjacent,
  swapIfMatches,
  resolveBoard,
  scoreForMatch,
  hasValidMove,
} from '../prototypes/openworld/animal-match3-engine.mjs'

test('creates a board without an initial match', () => {
  const board = createBoard(() => 0.37)
  assert.equal(board.length, BOARD_SIZE * BOARD_SIZE)
  assert.equal(findMatches(board).size, 0)
  assert.ok(board.every((type) => Number.isInteger(type) && type >= 0 && type < ACTIVE_TYPES.length))
  assert.equal(hasValidMove(board), true)
})

test('only orthogonally adjacent cells can swap', () => {
  assert.equal(isAdjacent(0, 1), true)
  assert.equal(isAdjacent(0, BOARD_SIZE), true)
  assert.equal(isAdjacent(0, BOARD_SIZE + 1), false)
  assert.equal(isAdjacent(0, 0), false)
})

test('invalid swap leaves the board unchanged and consumes no move', () => {
  const board = [
    0, 1, 2, 3, 4, 5, 0,
    1, 2, 3, 4, 5, 0, 1,
    2, 3, 4, 5, 0, 1, 2,
    3, 4, 5, 0, 1, 2, 3,
    4, 5, 0, 1, 2, 3, 4,
    5, 0, 1, 2, 3, 4, 5,
    0, 1, 2, 3, 4, 5, 0,
  ]
  const original = [...board]
  const result = swapIfMatches(board, 0, 1, () => 0)
  assert.equal(result.valid, false)
  assert.deepEqual(board, original)
})

test('resolves a match with gravity and refill', () => {
  const board = Array(BOARD_SIZE * BOARD_SIZE).fill(1)
  board[0] = 0
  board[1] = 2
  board[2] = 3
  const result = resolveBoard(board, () => 0)
  assert.ok(result.cleared >= BOARD_SIZE * BOARD_SIZE - 3)
  assert.equal(board.length, BOARD_SIZE * BOARD_SIZE)
  assert.ok(board.every((type) => type !== null))
})

test('score increases with match length and combo', () => {
  assert.equal(scoreForMatch(3, 1), 100)
  assert.equal(scoreForMatch(4, 1), 200)
  assert.equal(scoreForMatch(5, 1), 300)
  assert.equal(scoreForMatch(3, 3), 300)
})

test('four-match creates a line special block', () => {
  const board = createBoard(() => 0.23)
  board[0] = 0; board[1] = 0; board[2] = 0; board[3] = 0
  const specials = new Map()
  const result = resolveBoard(board, () => 0.61, specials, 1)
  assert.equal(result.specialCreated.kind, 'line')
  assert.equal(specials.get(result.specialCreated.index).kind, 'line')
})

test('five-match creates a rainbow special block', () => {
  const board = createBoard(() => 0.23)
  board[0] = 1; board[1] = 1; board[2] = 1; board[3] = 1; board[4] = 1
  const specials = new Map()
  const result = resolveBoard(board, () => 0.61, specials, 2)
  assert.equal(result.specialCreated.kind, 'rainbow')
  assert.equal(specials.get(result.specialCreated.index).kind, 'rainbow')
})

test('returns the exact cells that formed each match', () => {
  const board = createBoard(() => 0.23)
  board[0] = 0; board[1] = 0; board[2] = 0; board[3] = 0
  const result = resolveBoard(board, () => 0.61, new Map(), 1)
  assert.ok(result.effects.some((effect) => effect.size === 4 && [0, 1, 2, 3].every((index) => effect.indices.includes(index))))
})
