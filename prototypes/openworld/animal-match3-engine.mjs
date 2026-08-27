/*
 * Open-source adaptation note
 *
 * The always-have-a-move board-generation idea is adapted from:
 * https://github.com/Ghamza-Jd/Match-3
 * MIT License.
 *
 * This is an independent DOM-friendly engine for the service. The original
 * Cocos Creator project and its artwork are not bundled; only the general
 * board-solving approach is reused with our own animals and rules.
 */

export const BOARD_SIZE = 7
export const ACTIVE_TYPES = [
  { id: 'turtle', name: '거북이', emoji: '🐢', color: '#79c98b' },
  { id: 'giraffe', name: '기린', emoji: '🦒', color: '#f4c95d' },
  { id: 'penguin', name: '펭귄', emoji: '🐧', color: '#8ec9e8' },
  { id: 'hamster', name: '햄스터', emoji: '🐹', color: '#e5ae86' },
  { id: 'frog', name: '개구리', emoji: '🐸', color: '#83c96d' },
  { id: 'hedgehog', name: '고슴도치', emoji: '🦔', color: '#c79873' },
]
export const EXTRA_TYPES = [
  { id: 'alpaca', name: '알파카', emoji: '🦙', color: '#ead9bd' },
  { id: 'swan', name: '백조', emoji: '🦢', color: '#c7d9ef' },
]

const indexOf = (row, col) => row * BOARD_SIZE + col
const rowOf = (index) => Math.floor(index / BOARD_SIZE)
const colOf = (index) => index % BOARD_SIZE
const randomType = (rng) => Math.floor(rng() * ACTIVE_TYPES.length)

export function isAdjacent(a, b) {
  const rowDelta = Math.abs(rowOf(a) - rowOf(b))
  const colDelta = Math.abs(colOf(a) - colOf(b))
  return rowDelta + colDelta === 1
}

export function findMatches(board) {
  const matches = new Set()
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let start = 0
    while (start < BOARD_SIZE) {
      const type = board[indexOf(row, start)]
      let end = start + 1
      while (end < BOARD_SIZE && board[indexOf(row, end)] === type) end += 1
      if (type !== null && type !== undefined && end - start >= 3) {
        for (let col = start; col < end; col += 1) matches.add(indexOf(row, col))
      }
      start = end
    }
  }
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let start = 0
    while (start < BOARD_SIZE) {
      const type = board[indexOf(start, col)]
      let end = start + 1
      while (end < BOARD_SIZE && board[indexOf(end, col)] === type) end += 1
      if (type !== null && type !== undefined && end - start >= 3) {
        for (let row = start; row < end; row += 1) matches.add(indexOf(row, col))
      }
      start = end
    }
  }
  return matches
}

function findMatchRuns(board) {
  const runs = []
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let start = 0
    while (start < BOARD_SIZE) {
      const type = board[indexOf(row, start)]
      let end = start + 1
      while (end < BOARD_SIZE && board[indexOf(row, end)] === type) end += 1
      if (type !== null && type !== undefined && end - start >= 3) {
        runs.push({ axis: 'row', indices: Array.from({ length: end - start }, (_, offset) => indexOf(row, start + offset)) })
      }
      start = end
    }
  }
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let start = 0
    while (start < BOARD_SIZE) {
      const type = board[indexOf(start, col)]
      let end = start + 1
      while (end < BOARD_SIZE && board[indexOf(end, col)] === type) end += 1
      if (type !== null && type !== undefined && end - start >= 3) {
        runs.push({ axis: 'col', indices: Array.from({ length: end - start }, (_, offset) => indexOf(start + offset, col)) })
      }
      start = end
    }
  }
  return runs
}

export function findMatchEffects(board) {
  return findMatchRuns(board).map((run) => ({ size: run.indices.length, indices: [...run.indices], axis: run.axis }))
}

function canPlace(board, index, type) {
  const row = rowOf(index)
  const col = colOf(index)
  return !(col >= 2 && board[index - 1] === type && board[index - 2] === type)
    && !(row >= 2 && board[index - BOARD_SIZE] === type && board[index - BOARD_SIZE * 2] === type)
}

export function createBoard(rng = Math.random) {
  const board = Array(BOARD_SIZE * BOARD_SIZE).fill(null)
  for (let index = 0; index < board.length; index += 1) {
    const choices = ACTIVE_TYPES.map((_, type) => type).filter((type) => canPlace(board, index, type))
    board[index] = choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))]
  }
  if (!hasValidMove(board)) {
    for (let attempt = 0; attempt < 20 && !hasValidMove(board); attempt += 1) {
      for (let index = board.length - 1; index > 0; index -= 1) {
        const other = Math.floor(rng() * (index + 1))
        ;[board[index], board[other]] = [board[other], board[index]]
      }
    }
  }
  return board
}

export function hasValidMove(board) {
  for (let index = 0; index < board.length; index += 1) {
    const right = colOf(index) < BOARD_SIZE - 1 ? index + 1 : -1
    const down = rowOf(index) < BOARD_SIZE - 1 ? index + BOARD_SIZE : -1
    for (const other of [right, down]) {
      if (other < 0) continue
      ;[board[index], board[other]] = [board[other], board[index]]
      const valid = findMatches(board).size > 0
      ;[board[index], board[other]] = [board[other], board[index]]
      if (valid) return true
    }
  }
  return false
}

function refill(board, rng, specials = new Map()) {
  for (const index of [...specials.keys()]) {
    if (board[index] === null || board[index] === undefined) specials.delete(index)
  }
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const values = []
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const value = board[indexOf(row, col)]
      if (value !== null && value !== undefined) values.push(value)
    }
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      board[indexOf(row, col)] = values[BOARD_SIZE - 1 - row] ?? null
    }
  }
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] !== null && board[index] !== undefined) continue
    const choices = ACTIVE_TYPES.map((_, type) => type).filter((type) => canPlace(board, index, type))
    board[index] = choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))]
  }
}

export function resolveBoard(board, rng = Math.random, specials = new Map(), preferredSpecialIndex = -1) {
  let cleared = 0
  let chains = 0
  const matches = []
  const effects = []
  let specialCreated = null
  while (true) {
    const found = findMatches(board)
    if (!found.size) break
    for (const run of findMatchRuns(board)) effects.push({ size: run.indices.length, indices: [...run.indices], axis: run.axis })
    chains += 1
    cleared += found.size
    matches.push(found.size)
    const longest = Math.max(...matches)
    if (!specialCreated && preferredSpecialIndex >= 0 && found.has(preferredSpecialIndex)) {
      const kind = longest >= 5 ? 'rainbow' : longest === 4 ? 'line' : null
      if (kind) {
        specialCreated = { kind, index: preferredSpecialIndex, type: board[preferredSpecialIndex], axis: kind === 'line' ? 'row' : null }
        specials.set(preferredSpecialIndex, specialCreated)
      }
    }
    for (const index of found) {
      if (specialCreated && index === specialCreated.index) continue
      board[index] = null
    }
    refill(board, rng, specials)
  }
  return { cleared, chains, matches, effects, specialCreated }
}

export function scoreForMatch(length, combo = 1) {
  const base = length >= 5 ? 300 : length === 4 ? 200 : 100
  return base * Math.max(1, combo)
}

export function swapIfMatches(board, first, second, rng = Math.random, specials = new Map(), alreadySwapped = false) {
  if (!isAdjacent(first, second)) return { valid: false, cleared: 0, chains: 0, score: 0 }
  if (!alreadySwapped) ;[board[first], board[second]] = [board[second], board[first]]
  const activeSpecial = specials.get(first) || specials.get(second)
  if (activeSpecial) {
    const specialIndex = specials.has(first) ? first : second
    const targetType = board[specialIndex === first ? second : first]
    if (activeSpecial.kind === 'rainbow') {
      for (let index = 0; index < board.length; index += 1) {
        if (board[index] === targetType) board[index] = null
      }
    } else {
      const row = rowOf(specialIndex), col = colOf(specialIndex)
      for (let index = 0; index < board.length; index += 1) {
        if (activeSpecial.axis === 'col' ? colOf(index) === col : rowOf(index) === row) board[index] = null
      }
    }
    specials.delete(specialIndex)
    const result = resolveBoard(board, rng, specials)
    const score = 250 + result.matches.reduce((sum, length, index) => sum + scoreForMatch(length, index + 1), 0)
    return { valid: true, ...result, score, specialActivated: activeSpecial.kind }
  }
  if (!findMatches(board).size) {
    ;[board[first], board[second]] = [board[second], board[first]]
    return { valid: false, cleared: 0, chains: 0, score: 0 }
  }
  const result = resolveBoard(board, rng, specials, second)
  const score = result.matches.reduce((sum, length, index) => sum + scoreForMatch(length, index + 1), 0)
  return { valid: true, ...result, score }
}
