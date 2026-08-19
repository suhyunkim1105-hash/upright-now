# Animal Runner Mini-Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the giraffe neck mini-game in the openworld prototype with a three-minute Phaser animal runner that returns a score result to the parent service.

**Architecture:** Keep the existing standalone `prototypes/openworld/index.html` panel and event delegation. Put deterministic scoring, timing, collision penalties, and spawn decisions in a small dependency-free engine module; put Phaser rendering and input in a separate mountable game module with explicit `destroy()` lifecycle. The panel owns the game instance and forwards the selected `ROOM.character` plus the completion callback.

**Tech Stack:** Existing Vite/vanilla prototype, Phaser 3 npm dependency, ES modules, Node test scripts.

## Global Constraints

- `GAME_DURATION` is 180 seconds.
- Use Phaser Arcade Physics only; do not add Matter Physics or another game engine.
- Use local character assets and generated placeholder shapes only; do not copy external artwork or audio.
- Do not modify the React application routes for this prototype-only replacement.
- Do not write XP or database data from the game; return `{ score, coins, hitCount, maxCombo, playTime }` to the parent.
- Preserve the pre-existing unrelated `package-lock.json` working-tree change.
- Every timer, event listener, Phaser instance, and DOM control must be cleaned up on restart and close.

---

### Task 1: Add Phaser and failing engine tests

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `prototypes/openworld/animal-runner-engine.mjs`
- Create: `scripts/animal-runner-engine.test.mjs`

**Interfaces:**
- Produces `RUNNER_CONFIG`, `createRunnerState()`, `difficultyAt(elapsedMs)`, `canJump(state)`, `collectCoin(state, coinId)`, `hitObstacle(state, now)`, `tickRunner(state, now)`, and `finishRunner(state, now)`.

- [ ] **Step 1: Write failing engine tests**

  Add tests that import the named functions and assert:
  - a new state is `READY` with zero score, coins, hits, and combo;
  - `canJump` is true on the ground and false while airborne;
  - collecting the same coin id twice increases coins only once;
  - the first obstacle hit applies `-200` once and blocks another hit during 1000ms invincibility;
  - difficulty multipliers are `1`, `1.1`, and `1.2` before 60s, at 60s, and at 120s;
  - `finishRunner` returns a single result with play time capped at 180000ms.

- [ ] **Step 2: Run the focused test and verify RED**

  Run `node --test scripts/animal-runner-engine.test.mjs`.
  Expected: fail because `animal-runner-engine.mjs` and its exports do not exist yet.

- [ ] **Step 3: Install Phaser**

  Run `npm install phaser@^3.90.0` and keep the dependency in `package.json` and `package-lock.json`.

- [ ] **Step 4: Implement the minimal deterministic engine**

  Export the configuration and functions named above. Store `invincibleUntil`, `airborne`, `collectedCoins`, `score`, `coins`, `hitCount`, `combo`, `maxCombo`, `startedAt`, and `endedAt` on state. Make `collectCoin` idempotent and `hitObstacle` a no-op while invincible.

- [ ] **Step 5: Run the focused test and verify GREEN**

  Run `node --test scripts/animal-runner-engine.test.mjs`.
  Expected: all focused tests pass.

- [ ] **Step 6: Commit the engine slice**

  Run `git add package.json package-lock.json prototypes/openworld/animal-runner-engine.mjs scripts/animal-runner-engine.test.mjs && git commit -m "feat: add animal runner engine"`.

### Task 2: Add Phaser RunnerScene and lifecycle tests

**Files:**
- Create: `prototypes/openworld/animal-runner-game.mjs`
- Create: `scripts/animal-runner-game.test.mjs`

**Interfaces:**
- Produces `mountAnimalRunner({ container, character, onGameComplete })` returning `{ restart, destroy }`.
- `character` accepts `{ id, name, image }`; `image` may be an HTML canvas/image or be absent for placeholder fallback.

- [ ] **Step 1: Write failing lifecycle/wiring tests**

  Assert the module exports `mountAnimalRunner`, the public API contains `restart` and `destroy`, the module references `Phaser.Game`, `RunnerScene`, the 180-second config, mobile controls, and the completion result fields.

- [ ] **Step 2: Run the focused test and verify RED**

  Run `node --test scripts/animal-runner-game.test.mjs`.
  Expected: fail because the game module does not exist.

- [ ] **Step 3: Implement `RunnerScene`**

  Configure a 390x700 FIT canvas with Arcade Physics, create a generated sky/ground background, create a player texture from the supplied image or a colored placeholder, add a static ground body, and keep the player between 10% and 50% of the viewport width. Use keyboard cursors/A/D/Space/Up and three large DOM buttons for left/right/jump.

- [ ] **Step 4: Implement gameplay objects**

  Spawn low/high obstacles and coin patterns from the right edge with a safe minimum interval. Move them left using the current difficulty multiplier. On coin overlap call `collectCoin`; on obstacle collision call `hitObstacle`, apply a one-second slowdown and one-second blink, and reset combo without ending the game. Stop all spawns and input after GAME_OVER.

- [ ] **Step 5: Implement the result callback and lifecycle**

  On 180 seconds call `finishRunner` once and invoke `onGameComplete(result)`. `restart()` must reset the Phaser scene and all engine state. `destroy()` must remove DOM controls, keyboard listeners, timers, Phaser groups, and the Phaser instance.

- [ ] **Step 6: Run the focused tests and type/build checks**

  Run `node --test scripts/animal-runner-game.test.mjs` and `npm run typecheck`.
  Expected: focused tests pass and TypeScript compilation exits 0.

- [ ] **Step 7: Commit the Phaser game slice**

  Run `git add prototypes/openworld/animal-runner-game.mjs scripts/animal-runner-game.test.mjs && git commit -m "feat: add phaser animal runner"`.

### Task 3: Replace the openworld mini-game panel

**Files:**
- Modify: `prototypes/openworld/index.html`
- Create: `scripts/animal-runner.test.mjs`

**Interfaces:**
- Panel name becomes `동물 달리기` and replaces the existing `giraffeNeck` gate.
- Panel creates `mountAnimalRunner` with `ROOM.character`, `CHAR_SPECIES`, and `GIRIN_CHAR.mine()` when available.
- Completion callback renders the result and calls `gameReward('동물 달리기 성공')` once.

- [ ] **Step 1: Write failing static wiring tests**

  Assert the HTML contains `animalRunner`, `동물 달리기`, `mountAnimalRunner`, `onGameComplete`, `ROOM.character`, `GIRIN_CHAR.mine`, `destroy`, and the result labels `RUN COMPLETE`, `최종 점수`, `획득 코인`.

- [ ] **Step 2: Run the focused test and verify RED**

  Run `node --test scripts/animal-runner.test.mjs`.
  Expected: fail because the old giraffe panel is still wired.

- [ ] **Step 3: Add the module import and panel adapter**

  Import `mountAnimalRunner` in the existing module script, add `animalRunnerHtml`, `animalRunnerIntroHtml`, `startAnimalRunner`, `finishAnimalRunner`, and `closeAnimalRunner` helpers. Keep the existing panel header, close button, reward channel, and result layout.

- [ ] **Step 4: Replace only the gate/panel mapping**

  Change the gate label and panel key for the former giraffe-neck slot. Do not remove the other mini-games or change unrelated world rendering.

- [ ] **Step 5: Run the focused wiring test**

  Run `node --test scripts/animal-runner.test.mjs`.
  Expected: all wiring assertions pass.

- [ ] **Step 6: Commit the integration slice**

  Run `git add prototypes/openworld/index.html scripts/animal-runner.test.mjs && git commit -m "feat: replace giraffe game with animal runner"`.

### Task 4: Verify the full feature

**Files:**
- Modify: none unless verification identifies a defect.

- [ ] **Step 1: Run all automated checks**

  Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

- [ ] **Step 2: Start the Vite server**

  Run `npm run dev` and open `/prototypes/openworld/` over HTTP. Do not use `file://` because Phaser is an npm module.

- [ ] **Step 3: Exercise the browser flow**

  Open the former giraffe gate, verify the selected character is visible, verify 3-2-1-GO, test keyboard and mobile controls, collect a coin, hit an obstacle, verify invincibility, close and reopen the panel, and use restart. Use a test-time clock or a temporary accelerated duration only for local verification; production configuration remains 180 seconds.

- [ ] **Step 4: Inspect the final diff and status**

  Run `git diff --check`, `git status --short`, and review that the only remaining unrelated change is the pre-existing `package-lock.json` modification if npm did not incorporate it.

- [ ] **Step 5: Commit any verified fixes**

  If a defect was fixed, run the relevant focused test again and commit with a specific message such as `fix: clean up runner restart lifecycle`.

