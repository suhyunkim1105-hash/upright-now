# Campus Tile Battle Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a small animated giraffe-versus-turtle battle on the affected campus tile whenever a new realtime territory event arrives, then leave the authoritative server tile state visible.

**Architecture:** Reuse the existing `CampusTileEvent` stream and `CharacterViewport` (stage 6 giraffe and stage 1 turtle). A pure event-diff helper will identify only newly received events after the initial snapshot; the campus store will expose short-lived active battle scenes, and `TerritoryMap` will render them in a fixed-size SVG `foreignObject` overlay without changing map geometry.

**Tech Stack:** React 19, TypeScript, Zustand, Supabase Realtime, SVG/`foreignObject`, existing Tailwind/CSS animation utilities, Vitest and Testing Library.

## Global Constraints

- Keep the map size and tile layout unchanged.
- Use the existing giraffe and turtle character assets; do not add official school logos or mascots.
- Do not add a database table or persist character positions.
- Only verified schools can create contribution events; viewers may still observe events.
- Realtime events are authoritative; client animation is presentation only.
- Deduplicate by `CampusTileEvent.id` and never replay historical events on initial load or reconnect snapshot.
- Respect `prefers-reduced-motion` with a short fade/static state.
- Do not transmit camera frames, landmarks, posture coordinates, or personal email addresses.

---

### Task 1: Define and test the battle-event diff model

**Files:**
- Create: `src/features/campus/battle.ts`
- Test: `src/features/campus/battle.spec.ts`
- Modify: `src/features/campus/types.ts` only if a dedicated `CampusBattleScene` type is needed

**Interfaces:**
- Consumes: `CampusTileEvent[]`, current realtime connection state, and a `now` timestamp.
- Produces: `CampusBattleScene` with `eventId`, `tileId`, `attackerSchoolId`, `defenderSchoolId`, `startedAt`, and `expiresAt`; `newBattleScenes(previous: CampusTileEvent[], next: CampusTileEvent[], initialized: boolean, now: number): CampusBattleScene[]`.

- [ ] **Step 1: Write failing tests for initial-load suppression, new-event detection, and deduplication.**

```ts
it('does not animate the initial snapshot', () => {
  expect(newBattleScenes([], events, false, 1000)).toEqual([])
})

it('creates one scene for a newly received event', () => {
  const scenes = newBattleScenes([events[0]], [events[0], events[1]], true, 1000)
  expect(scenes).toEqual([
    expect.objectContaining({
      eventId: events[1].id,
      tileId: events[1].tileId,
      attackerSchoolId: events[1].toSchoolId,
      defenderSchoolId: events[1].fromSchoolId,
      expiresAt: 4000,
    }),
  ])
})

it('does not create a second scene when the same event is replayed', () => {
  expect(newBattleScenes(events, events, true, 1000)).toEqual([])
})
```

- [ ] **Step 2: Run the focused test and verify it fails because the helper does not exist.**

Run: `npx vitest run src/features/campus/battle.spec.ts`

Expected: FAIL with an import or missing-function error.

- [ ] **Step 3: Implement the pure helper.**

Use `CampusTileEvent.id` as the set key, map `toSchoolId` to the attacker and `fromSchoolId` to the defender, and set `expiresAt = now + 3000`. Return events in chronological order while filtering out unknown/duplicate IDs.

- [ ] **Step 4: Run the focused test and verify it passes.**

Run: `npx vitest run src/features/campus/battle.spec.ts`

Expected: all battle helper tests pass.

- [ ] **Step 5: Commit the pure model and tests.**

```bash
git add src/features/campus/battle.ts src/features/campus/battle.spec.ts src/features/campus/types.ts
git commit -m "feat: model campus tile battle scenes"
```

### Task 2: Feed new realtime events into the campus store

**Files:**
- Modify: `src/features/campus/campusStore.ts` (`CampusStoreState`, `applySnapshot`, reset/dispose paths)
- Test: `src/features/campus/campusStore.spec.ts`

**Interfaces:**
- Consumes: `newBattleScenes` from Task 1 and existing `CampusSnapshot.tileEvents`.
- Produces: `activeBattleScenes: CampusBattleScene[]` in `useCampusStore`; scenes expire after 3 seconds and are removed by event ID.

- [ ] **Step 1: Add failing store tests.**

Cover these exact cases: first `load()` leaves `activeBattleScenes` empty; a later snapshot containing one new event adds one scene; applying the same snapshot twice leaves one scene; disposing/resetting the campus clears scenes.

- [ ] **Step 2: Run the focused store tests and verify the new assertions fail.**

Run: `TASK_LOCALSTORAGE_FILE=/private/tmp/upright-now-vitest-localstorage NODE_OPTIONS="--localstorage-file=$TASK_LOCALSTORAGE_FILE" npx vitest run src/features/campus/campusStore.spec.ts`

Expected: the new active-scene assertions fail before implementation.

- [ ] **Step 3: Implement store integration.**

Track whether the first snapshot has been initialized. In `applySnapshot`, diff the previous snapshot’s event IDs, add only newly received scenes when `realtimeStatus === 'connected'`, schedule removal with `window.setTimeout`, and keep `recentBattleEvents` unchanged for the existing history panel. On `disposeCampus()`/repository disposal, clear the scene list and expiry timers.

- [ ] **Step 4: Run the focused store tests.**

Run the same focused command from Step 2.

Expected: all store tests, including the new scene lifecycle assertions, pass.

- [ ] **Step 5: Commit store integration.**

```bash
git add src/features/campus/campusStore.ts src/features/campus/campusStore.spec.ts
git commit -m "feat: expose live campus battle scenes"
```

### Task 3: Render the small giraffe and turtle overlay on each tile

**Files:**
- Create: `src/components/campus/CampusBattleOverlay.tsx`
- Create: `src/components/campus/CampusBattleOverlay.spec.tsx`
- Modify: `src/components/campus/TerritoryMap.tsx`

**Interfaces:**
- Consumes: `activeBattleScenes`, `gridCellFor`, `useSchoolIdentity`, and `CharacterViewport`.
- Produces: one `foreignObject` overlay per active scene, positioned at the existing tile center and clipped to the tile footprint.

- [ ] **Step 1: Write failing component tests.**

Assert that one scene renders exactly two character viewports, includes accessible text naming the attacking and defending schools, uses stage `6` for the giraffe and stage `1` for the turtle, and renders nothing for an empty scene list.

- [ ] **Step 2: Run the component test and verify it fails.**

Run: `npx vitest run src/components/campus/CampusBattleOverlay.spec.tsx`

Expected: FAIL because the overlay component and test selectors do not exist.

- [ ] **Step 3: Implement the overlay.**

Render a `<foreignObject>` centered on `gridCellFor(tile).cx/cy` with fixed dimensions relative to the existing 1536×1024 viewBox. Place the stage 6 `CharacterViewport` on the left with `visualState="attack"` and the stage 1 viewport on the right with `visualState="idle"`; use school colors for borders/effects. Add `pointerEvents="none"`, `overflow="hidden"`, and a visually-hidden live description. If the defender is null, use the neutral defense color and label.

- [ ] **Step 4: Add the overlay to `TerritoryMap` without changing the map viewBox or tile coordinates.**

Render `CampusBattleOverlay` after each tile’s status markers so it appears above the tile but below selection controls. Pass only matching active scenes for the tile.

- [ ] **Step 5: Run the focused component tests.**

Run: `npx vitest run src/components/campus/CampusBattleOverlay.spec.tsx`

Expected: all overlay tests pass.

- [ ] **Step 6: Commit the map overlay.**

```bash
git add src/components/campus/CampusBattleOverlay.tsx src/components/campus/CampusBattleOverlay.spec.tsx src/components/campus/TerritoryMap.tsx
git commit -m "feat: show giraffe and turtle tile battles"
```

### Task 4: Add motion, reduced-motion, and full verification

**Files:**
- Modify: `src/index.css` with scoped campus battle keyframes/classes
- Test: `src/components/campus/TerritoryMap.spec.tsx` or the existing campus component test location
- Modify: `docs/superpowers/specs/2026-07-31-campus-tile-battle-design.md` only if implementation decisions materially differ

**Interfaces:**
- Consumes: overlay class names from Task 3 and the existing `usePrefersReducedMotion` behavior inside `CharacterViewport`.
- Produces: 2–3 second attack/defense movement, a short tile pulse, and a static/fade fallback for reduced motion.

- [ ] **Step 1: Add failing style/DOM assertions for the battle classes and reduced-motion class.**

Assert that the overlay root has `campus-battle-overlay`, attacker/defender classes, and the reduced-motion path does not add continuous movement classes.

- [ ] **Step 2: Implement scoped CSS.**

Add `@keyframes campus-battle-attack`, `campus-battle-defend`, and `campus-battle-pulse`; keep animation duration between `2000ms` and `3000ms`; add a `prefers-reduced-motion: reduce` rule that disables transforms and leaves only a brief opacity transition.

- [ ] **Step 3: Run all focused tests.**

Run:

```bash
TASK_LOCALSTORAGE_FILE=/private/tmp/upright-now-vitest-localstorage \
NODE_OPTIONS="--localstorage-file=$TASK_LOCALSTORAGE_FILE" \
npx vitest run src/features/campus/battle.spec.ts src/features/campus/campusStore.spec.ts src/components/campus/CampusBattleOverlay.spec.tsx
```

Expected: all focused battle tests pass.

- [ ] **Step 4: Run the project verification suite.**

Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. Existing lint warnings may remain, but there must be zero errors and the build must exit successfully.

- [ ] **Step 5: Perform the two-browser manual test.**

Use two separately authenticated school accounts, open `/campus` in both, verify both show `실시간 연결됨`, contribute to the same tile, and confirm both screens show the small giraffe/turtle battle without resizing the map. Confirm a reconnect refreshes state without replaying old events.

- [ ] **Step 6: Commit final animation styles and verification tests.**

```bash
git add src/index.css src/components/campus/TerritoryMap.spec.tsx docs/superpowers/specs/2026-07-31-campus-tile-battle-design.md
git commit -m "feat: animate campus tile battles"
```
