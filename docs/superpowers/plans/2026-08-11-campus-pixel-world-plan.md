# 캠퍼스 픽셀 월드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a first `/campus/world` pixel dormitory world with Phaser, local turtle/giraffe avatar movement, collisions, idle/walk/sit states, and React UI overlays without changing the existing `/campus` territory screen.

**Architecture:** React owns routing, page chrome, accessibility text, and avatar metadata. Phaser is mounted inside the world page and owns the 16×16 tile-based dorm scene, keyboard input, collisions, and sprite animation. The first version is local-only; Supabase Realtime is intentionally not involved until the world loop is stable.

**Tech Stack:** React 19, TypeScript strict, Vite, React Router, Phaser 3, Vitest/Testing Library, existing Tailwind/CSS tokens.

## Global Constraints

- Keep `/campus` and `/campus/map` behavior unchanged.
- Do not store or transmit camera frames, posture landmarks, or private posture states.
- Use 16×16 map tiles, integer rendering scale, and 16×24 avatar frames.
- Use original or explicitly licensed pixel assets; do not copy reference-game assets.
- World avatar data remains separate from existing long-term growth-stage assets.
- Before handoff, `npm run typecheck`, `npm run build`, and focused tests must pass.

---

### Task 1: Add Phaser dependency and world route shell

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/app/router/AppRoutes.tsx`
- Create: `src/app/routes/CampusWorld.tsx`
- Create: `src/components/campus/world/CampusWorldShell.tsx`
- Test: `src/app/routes/CampusWorld.spec.tsx`

**Interfaces:**
- Produces route `/campus/world` and a `CampusWorldShell` mount point with `data-testid="campus-world-shell"`.
- `CampusWorldShell` accepts `displayName`, `schoolName`, `schoolColor`, `level`, and `characterKey`.

- [ ] **Step 1: Add the dependency and verify the lockfile**

Run:

```bash
npm install phaser
```

Expected: `package.json` and `package-lock.json` contain Phaser and the existing dependency graph remains installable.

- [ ] **Step 2: Write the route test**

Add this focused test shape to `src/app/routes/CampusWorld.spec.tsx`:

```tsx
it('renders the dorm world shell and return link', () => {
  render(<CampusWorld />)
  expect(screen.getByRole('heading', { name: '기숙사' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '캠퍼스로 돌아가기' })).toHaveAttribute('href', '/campus')
  expect(screen.getByTestId('campus-world-shell')).toBeInTheDocument()
})
```

Mock `createPixelWorld` to return `vi.fn()` so the test does not create a real canvas.

- [ ] **Step 3: Register the route**

Import `CampusWorld` into `src/app/router/AppRoutes.tsx` and add `/campus/world` inside the existing `featureFlags.campusTerritory` block. Keep the existing campus routes unchanged.

- [ ] **Step 4: Implement the shell**

Create a responsive page with:

```text
뒤로가기 → /campus
장소명: 기숙사
Phaser mount container
조작 안내: 방향키/WASD 이동 · Space 앉기
```

Give the mount a minimum height of 384px and use `overflow: hidden` so the pixel canvas does not stretch non-integerly.

- [ ] **Step 5: Run focused checks**

Run:

```bash
npm run test -- src/app/routes/CampusWorld.spec.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/app/router/AppRoutes.tsx src/app/routes/CampusWorld.tsx src/components/campus/world/CampusWorldShell.tsx src/app/routes/CampusWorld.spec.tsx
git commit -m "feat: add campus pixel world route shell"
```

### Task 2: Add deterministic dorm map data and Phaser scene bootstrap

**Files:**
- Create: `src/features/campus/world/dormMap.ts`
- Create: `src/features/campus/world/PixelWorldScene.ts`
- Create: `src/features/campus/world/createPixelWorld.ts`
- Modify: `src/components/campus/world/CampusWorldShell.tsx`
- Test: `src/features/campus/world/dormMap.spec.ts`

**Interfaces:**
- `DORM_MAP_WIDTH = 40`, `DORM_MAP_HEIGHT = 24`, `TILE_SIZE = 16`.
- `DORM_MAP_LAYERS: { ground: number[]; collision: number[] }` has exactly `width * height` entries per layer.
- `PixelWorldConfig` is `{ characterKey: 'turtle' | 'giraffe'; displayName: string; schoolName: string; schoolColor: string; level: number; onPositionChange?: (position: { x: number; y: number }) => void }`.
- `createPixelWorld(container: HTMLElement, config: PixelWorldConfig): () => void` creates and destroys one Phaser game instance.

- [ ] **Step 1: Write map-data tests**

Add these assertions to `src/features/campus/world/dormMap.spec.ts`:

```ts
it('has a complete 40 by 24 layer', () => {
  expect(DORM_MAP_LAYERS.ground).toHaveLength(40 * 24)
  expect(DORM_MAP_LAYERS.collision).toHaveLength(40 * 24)
})

it('blocks the outer boundary and leaves spawn walkable', () => {
  expect(DORM_MAP_LAYERS.collision[0]).toBe(COLLISION_BLOCKED)
  expect(DORM_MAP_LAYERS.collision[(24 - 1) * 40 + (40 - 1)]).toBe(COLLISION_BLOCKED)
  expect(isWalkable(DORM_SPAWN.x, DORM_SPAWN.y)).toBe(true)
})
```

- [ ] **Step 2: Implement map data**

Use numeric tile IDs for floor, wall, rug, bed, desk, plant, and door. Keep collision IDs separate from visual IDs so furniture can be changed without rewriting movement logic.

- [ ] **Step 3: Implement a generated pixel tileset**

Create a small in-memory Phaser texture using crisp rectangles/colors for the first prototype. Do not add external art yet. The scene must still look pixelated and prove the tile dimensions.

- [ ] **Step 4: Implement `PixelWorldScene`**

Create the ground layer, draw collision tiles, set camera bounds, and spawn the player at the configured spawn tile. Use `pixelArt: true`, `roundPixels: true`, and a 3× zoom.

- [ ] **Step 5: Mount and destroy safely**

`CampusWorldShell` calls `createPixelWorld` in an effect and invokes the returned cleanup function on unmount. Re-mounting must not leave duplicate canvases or keyboard listeners.

- [ ] **Step 6: Run checks and commit**

```bash
npm run test -- src/features/campus/world/dormMap.spec.ts
npm run typecheck
git add src/features/campus/world src/components/campus/world/CampusWorldShell.tsx src/features/campus/world/dormMap.spec.ts
git commit -m "feat: bootstrap pixel dormitory world"
```

### Task 3: Implement local avatar movement, collision, and animation states

**Files:**
- Create: `src/features/campus/world/worldCharacter.ts`
- Create: `src/features/campus/world/worldCharacter.spec.ts`
- Modify: `src/features/campus/world/PixelWorldScene.ts`
- Create: `src/assets/world/README.md`

**Interfaces:**
- `WorldCharacter` has `characterKey`, `displayName`, `schoolName`, `schoolColor`, `level`, `position`, and `animation`.
- `getNextWorldCharacterState(current, input): WorldCharacterState` returns `idle`, `walking`, or `sitting`.
- `createWorldCharacter(scene, config): Phaser.GameObjects.Sprite` returns a sprite with a stable bottom-center origin.

- [ ] **Step 1: Write state-transition tests**

Add these cases to `src/features/campus/world/worldCharacter.spec.ts`:

```ts
expect(getNextWorldCharacterState('idle', { moving: false, toggleSit: false })).toBe('idle')
expect(getNextWorldCharacterState('idle', { moving: true, toggleSit: false })).toBe('walking')
expect(getNextWorldCharacterState('idle', { moving: false, toggleSit: true })).toBe('sitting')
expect(getNextWorldCharacterState('sitting', { moving: false, toggleSit: true })).toBe('idle')
expect(getNextWorldCharacterState('sitting', { moving: true, toggleSit: false })).toBe('walking')
```

- [ ] **Step 2: Implement the pure state machine**

Keep keyboard event details out of the pure function. The function receives booleans for direction and `toggleSit` so it can be tested without Phaser.

- [ ] **Step 3: Add prototype turtle and giraffe sprites**

Until final artwork is supplied, create two simple original pixel placeholders in the generated texture: a green turtle silhouette and a yellow/ochre giraffe silhouette. Document the replacement format in `src/assets/world/README.md`.

- [ ] **Step 4: Add keyboard movement and collision**

Use Phaser cursor keys plus WASD. Move using delta time, test the next position against the collision layer, and preserve the last facing direction when idle.

- [ ] **Step 5: Add animations**

Create `idle`, `walk-down`, `walk-up`, `walk-side`, and `sit` animations. If the placeholder has only one frame, duplicate it without changing the state API.

- [ ] **Step 6: Verify behavior and commit**

```bash
npm run test -- src/features/campus/world/worldCharacter.spec.ts
npm run typecheck
npm run build
git add src/features/campus/world src/assets/world
git commit -m "feat: add local pixel avatar movement"
```

### Task 4: Add HTML identity overlay and responsive controls

**Files:**
- Create: `src/components/campus/world/WorldCharacterLabel.tsx`
- Create: `src/components/campus/world/WorldCharacterLabel.spec.tsx`
- Modify: `src/components/campus/world/CampusWorldShell.tsx`
- Modify: `src/features/campus/world/PixelWorldScene.ts`

**Interfaces:**
- `WorldCharacterLabelProps` accepts `displayName`, `schoolName`, `level`, `schoolColor`, and screen-relative `position`.

- [ ] **Step 1: Write label tests**

Add this test to `src/components/campus/world/WorldCharacterLabel.spec.tsx`:

```tsx
it('renders identity and school accent', () => {
  render(<WorldCharacterLabel displayName="연우" schoolName="한양대" level={3} schoolColor="#315A9B" position={{ x: 40, y: 80 }} />)
  expect(screen.getByText('연우')).toBeInTheDocument()
  expect(screen.getByText('한양대')).toBeInTheDocument()
  expect(screen.getByText('Lv.3')).toBeInTheDocument()
  expect(screen.getByTestId('world-character-label')).toHaveStyle({ borderColor: '#315A9B' })
})
```

- [ ] **Step 2: Implement the label**

Render the label as an accessible DOM overlay rather than drawing text into the Phaser canvas. This keeps Korean text crisp and screen-reader readable.

- [ ] **Step 3: Synchronize screen position**

Expose the player’s world position from Phaser through a small callback throttled to animation frames. Convert it to canvas-relative coordinates and update the label without writing to Supabase.

- [ ] **Step 4: Add mobile-safe controls**

Keep keyboard controls as the primary input, add a compact visible instruction block, and ensure the canvas remains usable at narrow widths without stretching the pixel ratio.

- [ ] **Step 5: Test and commit**

```bash
npm run test -- src/components/campus/world/WorldCharacterLabel.spec.tsx
npm run typecheck
git add src/components/campus/world src/features/campus/world/PixelWorldScene.ts
git commit -m "feat: show pixel avatar identity overlay"
```

### Task 5: Route integration QA and handoff

**Files:**
- Modify: `e2e/routes.spec.ts` or create `e2e/campus-world.spec.ts`
- Modify: `src/app/routes/Campus.tsx` to add the `기숙사 월드 들어가기` link only if the route is not otherwise reachable from the existing campus page.

- [ ] **Step 1: Add route smoke coverage**

Add a Playwright test that visits `/campus/world`, asserts the `기숙사` heading and `campus-world-shell`, clicks `캠퍼스로 돌아가기`, and asserts the URL ends with `/campus`. Add a second assertion that a direct visit to `/campus` still shows the existing `캠퍼스` heading.

- [ ] **Step 2: Run the project quality gate**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

- [ ] **Step 3: Manually verify the first acceptance checklist**

Confirm the map is pixel-crisp, the avatar cannot cross walls or furniture, idle/walk/sit transitions work, identity text is readable, and no camera or Supabase request is made by the world route.

- [ ] **Step 4: Commit the QA changes**

```bash
git add e2e src/app/routes/Campus.tsx src/components/campus/world src/features/campus/world
git commit -m "test: verify campus pixel world route"
```
