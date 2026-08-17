# 동물 기억력 카드 게임 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `animalFind` mini-game at the `(32, 7)` gate with a stable 4×4 animal memory-card game playable in about 2–3 minutes.

**Architecture:** Keep the existing single-file open-world prototype and `animalFind` panel key. Replace the current animal-find engine with a DOM-independent memory-game engine, then connect it to the existing delegated pointer/click handlers in `prototypes/openworld/index.html`. Keep timers and persistence in the UI layer while the engine owns game state transitions.

**Tech Stack:** Plain JavaScript ES modules, HTML template strings, CSS 3D transforms, Node built-in test runner, existing Vite/static prototype setup.

## Global Constraints

- Keep the existing `(32, 7)` map gate and `animalFind` panel key.
- Use exactly 8 animals × 2 cards = 16 cards in a 4×4 grid.
- Use a 2,000ms preview and a 700ms mismatch delay as configuration constants.
- Do not add frameworks, game engines, dependencies, external image URLs, or backend storage.
- Block input in `PREVIEW`, `CHECKING`, and `GAME_OVER`.
- Clean every interval and timeout on restart, close, and completion.
- Do not modify Match-3, giraffe-neck, map movement, or unrelated prototype behavior.

---

### Task 1: Define the memory-game engine contract with tests

**Files:**
- Modify: `prototypes/openworld/animal-find-engine.mjs`
- Modify: `scripts/animal-find-engine.test.mjs`

**Interfaces:**
- Export `ANIMAL_MEMORY_TYPES`, `ANIMAL_MEMORY_CONFIG`, `createGame()`, `startGame()`, `selectCard()`, `resolvePendingPair()`, `tickGame()`, and `isGameComplete()`.
- State includes `status`, `cards`, `firstIndex`, `secondIndex`, `moves`, `score`, `combo`, `maxCombo`, `matchedPairs`, `previewEndsAt`, `startedAt`, and `playStartedAt`.
- Cards include unique `id`, `animalId`, `isFlipped`, and `isMatched` fields.

- [ ] Write failing tests for 16 cards, two cards per animal, 2-second preview, valid selection, same-pair match, mismatch resolution, all input locks, Move/Score/Combo, completion, and restart.
- [ ] Run `node --test scripts/animal-find-engine.test.mjs` and confirm the old engine fails the new contract.
- [ ] Implement the pure engine with Fisher–Yates shuffle and this configuration:

```js
export const ANIMAL_MEMORY_CONFIG = {
  previewDurationMs: 2000,
  mismatchDelayMs: 700,
  baseMatchScore: 100,
  comboBonusStep: 20,
  maxComboBonus: 3,
}
```

- [ ] Make `startGame` reveal all cards in `PREVIEW`; make `tickGame` transition to `PLAYING` without owning a timer.
- [ ] Make `selectCard` reject invalid, duplicate, matched, non-`PLAYING`, and second-selection inputs; make the second valid choice enter `CHECKING` and increment `moves`.
- [ ] Make `resolvePendingPair` keep matches visible or reset mismatches and Combo.
- [ ] Run the engine tests again and commit only the engine and its tests with `feat: add animal memory game engine`.

### Task 2: Replace the animal-find panel UI with the memory board

**Files:**
- Modify: `prototypes/openworld/index.html:7779-7916`
- Modify: `scripts/animal-find.test.mjs`

**Interfaces:**
- Consume the engine through `window.ANIMAL_FIND_ENGINE`.
- Keep `animalFind` start, restart, close, and panel routing connections.

- [ ] Add failing wiring assertions for `동물 기억력 게임`, `data-animal-memory-index`, `PREVIEW`, and the engine module connection.
- [ ] Run `node --test scripts/animal-find.test.mjs` and confirm the current animal-find UI fails those assertions.
- [ ] Replace the intro and active board with a 4-column grid of 16 accessible `<button>` cards.
- [ ] Render `TIME`, `MOVES`, `SCORE`, and `COMBO`, plus a short instruction and a result view with score, time, Move, max Combo, best records, restart, and close/service return controls.
- [ ] Add local CSS for `rotateY(180deg)` card flips, mismatch shake, and match glow. Keep touch targets large enough for mobile.
- [ ] Run the wiring test and confirm it passes.

### Task 3: Connect selection, preview, timer, persistence, and cleanup

**Files:**
- Modify: `prototypes/openworld/index.html:5198,8870-8935,10384-10387`
- Modify: `scripts/animal-find.test.mjs`

**Interfaces:**
- Consume `selectCard`, `resolvePendingPair`, `tickGame`, and `isGameComplete`.
- Produce stable delegated input and panel lifecycle cleanup.

- [ ] Add failing wiring assertions for the memory-card selector, mismatch timeout cleanup, game timer cleanup, and `GAME_OVER` result path.
- [ ] On start, clear old interval/timeout handles, create a fresh engine state, render Preview, and start one 100ms interval.
- [ ] On each tick, transition Preview and update elapsed play time; on completion, clear the interval and pending pair timeout before rendering results.
- [ ] Accept only memory-card and start/restart targets. After the second selection, enter `CHECKING`, render both cards, and schedule exactly one 700ms resolution timeout.
- [ ] Store the timeout ID so restart and close can cancel it.
- [ ] Persist these keys in `try/catch`: `girin.animalMemory.highScore`, `girin.animalMemory.bestTimeMs`, and `girin.animalMemory.bestMoves`.
- [ ] Run focused engine/wiring tests, inline JavaScript syntax validation, and `git diff --check`.
- [ ] Commit only the UI integration with `feat: replace animal find with memory cards`.

### Task 4: Run project verification and manual checks

**Files:**
- No source changes expected.

- [ ] Run `npm run test`.
- [ ] Run `npm run typecheck` and `npm run build`; confirm the build copies `prototypes/openworld` into `dist/prototypes/openworld`.
- [ ] Open `http://localhost:5173/prototypes/openworld/` and verify Preview, 4×4 layout, matching, mismatch flip-back, third-card lock, matched-card lock, timer, Move, Combo, result, restart, close, and no duplicate timers after repeated restarts.
- [ ] If a correction is needed, stage only the affected memory-game files; do not stage `package-lock.json`, animal-find leftovers, or unrelated working-tree changes.
