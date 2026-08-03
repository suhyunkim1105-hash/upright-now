# Campus Verification and Realtime Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a verified preset-school email before campus contribution or capture, and make server-authoritative campus battles visible live.

**Architecture:** Supabase Auth sends and verifies Email OTPs. A new SQL migration maps preset school IDs to allowed domains and records only a user ID, school ID, normalized domain, and timestamps. Existing write RPCs reject a missing or mismatched verification; the campus repository loads that status and the UI renders the current Realtime tile events as an accessible battle feed.

**Tech Stack:** React 18, TypeScript strict, Zustand, Vitest, Supabase Auth/Realtime/Postgres RPC/RLS, Vite, Playwright.

## Global Constraints

- Do not store or transmit camera video, frames, landmarks, posture coordinates, `bad` state, or health information.
- Keep email only in Supabase Auth; application tables retain user ID, preset school ID, email domain, and timestamps, never the raw email.
- Never expose a service-role key or mail-provider secret in the browser.
- Do not use official university logos or mascots; keep existing color/patterns labelled as prototype presets.
- An unverified user may view campus map and standings but cannot choose a game school, contribute, or capture.
- Custom schools remain personal themes only; only the ten `CAMPUS_SCHOOLS` presets can be verified.
- Preserve school-change limits, anonymous map viewing, Realtime reconnection, and reduced-motion behavior.
- Add every database change under `supabase/migrations/`; do not run it on the shared production server.

---

## File structure

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260730_campus_school_verification.sql` | Allowed-domain data, verification record, RPC/RLS authorization. |
| `src/features/campus/verification.ts` | Pure email/domain and contribution-permission logic. |
| `src/features/campus/verification.spec.ts` | Unit tests for pure verification logic. |
| `src/features/campus/types.ts` | `CampusVerification` type. |
| `src/features/campus/repository.ts`, `supabaseRepository.ts`, `mockRepository.ts` | Verification API contracts and Supabase OTP implementation. |
| `src/features/campus/campusStore.ts`, `useCampusScreen.ts` | Loaded verification state, battle event feed, write guard. |
| `src/components/campus/SchoolVerification.tsx` | Email/code form and recoverable error states. |
| `src/components/campus/CampusBattleFeed.tsx` | Accessible server-event feed. |
| `SchoolPicker.tsx`, `CampusPanels.tsx`, `TerritoryMap.tsx`, `Campus.tsx` | Verified selection, game copy, non-color map labels, and layout. |
| `e2e/campus.spec.ts`, `README.md`, `docs/14_DATA_PRIVACY_SECURITY.md` | Regression coverage and setup/privacy handoff. |

### Task 1: Secure school verification in Supabase

**Files:**
- Create: `supabase/migrations/20260730_campus_school_verification.sql`
- Modify: `supabase/README.md`
- Modify: `src/features/campus/campusSqlParity.spec.ts`

**Interfaces:**
- Consumes: `campus_schools`, `campus_set_school(text, text)`, and `campus_record_contribution(...)`.
- Produces: `campus_my_verification()`, `campus_verify_school(p_school_id text)`, and matching-verification checks inside existing write RPCs.

- [ ] **Step 1: Write failing SQL parity assertions**

```ts
it('requires matching verification before a school can write territory data', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  expect(sql).toContain('create table if not exists public.campus_school_domains')
  expect(sql).toContain('create table if not exists public.campus_verifications')
  expect(sql).toContain('create or replace function public.campus_verify_school')
  expect(sql).toContain("raise exception 'school_verification_required'")
  expect(sql).toContain('revoke insert, update, delete on public.campus_verifications')
})
```

- [ ] **Step 2: Run the focused test**

Run: `npm run test -- src/features/campus/campusSqlParity.spec.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement migration tables and verification RPC**

```sql
create table if not exists public.campus_school_domains (
  school_id text primary key references public.campus_schools(id) on delete cascade,
  email_domain text not null unique,
  created_at timestamptz not null default now(),
  check (email_domain = lower(email_domain) and email_domain !~ '[[:space:]@]')
);

create table if not exists public.campus_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id text not null references public.campus_schools(id),
  email_domain text not null,
  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Implement `campus_verify_school` as security-definer: obtain the email only from `auth.users` for `auth.uid()`, derive its domain, compare it with the requested school mapping, and upsert no data other than school/domain/timestamps. Seed only domains confirmed by the project owner; do not guess university domains. Enable RLS, provide self-only read through `campus_my_verification()`, revoke direct verification writes, and grant the verification RPC to `authenticated`. Update `campus_set_school` and `campus_record_contribution` to raise `school_verification_required` unless their requested school matches `campus_verifications.school_id`.

- [ ] **Step 4: Document and verify**

Add to `supabase/README.md`: enable Supabase Email provider and Email OTP, set production redirect URL, run the six baseline files, then this migration. Run: `npm run test -- src/features/campus/campusSqlParity.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260730_campus_school_verification.sql supabase/README.md src/features/campus/campusSqlParity.spec.ts
git commit -m "feat: secure campus contributions with school verification"
```

### Task 2: Add verification client contracts and OTP repository

**Files:**
- Create: `src/features/campus/verification.ts`
- Create: `src/features/campus/verification.spec.ts`
- Modify: `src/features/campus/types.ts`
- Modify: `src/features/campus/repository.ts`
- Modify: `src/features/campus/supabaseRepository.ts`
- Modify: `src/features/campus/mockRepository.ts`

**Interfaces:**
- Produces: `CampusVerification`, `normalizeSchoolEmail`, `verificationActionState`, `fetchMyVerification`, `requestSchoolVerification`, and `confirmSchoolVerification`.

- [ ] **Step 1: Write failing validation tests**

```ts
it('normalizes an email and derives its domain', () => {
  expect(normalizeSchoolEmail(' Student@SNU.AC.KR ')).toEqual({
    email: 'student@snu.ac.kr', domain: 'snu.ac.kr',
  })
})

it('allows only a matching verified school to contribute', () => {
  expect(verificationActionState({ schoolId: 'snu', verifiedSchoolId: null })).toBe('verification_required')
  expect(verificationActionState({ schoolId: 'snu', verifiedSchoolId: 'yonsei' })).toBe('school_mismatch')
  expect(verificationActionState({ schoolId: 'snu', verifiedSchoolId: 'snu' })).toBe('allowed')
})
```

- [ ] **Step 2: Run focused test**

Run: `npm run test -- src/features/campus/verification.spec.ts`

Expected: FAIL because `verification.ts` is absent.

- [ ] **Step 3: Implement the typed helpers and repository calls**

```ts
export interface CampusVerification {
  schoolId: string
  emailDomain: string
  verifiedAt: number
}

export function normalizeSchoolEmail(raw: string): { email: string; domain: string } | null {
  const email = raw.trim().toLowerCase()
  const match = /^([^@\s]+)@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(email)
  return match ? { email, domain: match[2] } : null
}
```

Implement `requestSchoolVerification(email)` with `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`. Implement `confirmSchoolVerification(schoolId, email, token)` with `verifyOtp({ email, token, type: 'email' })` followed by `campus_verify_school`; then load `campus_my_verification`. Return typed recoverable reasons `invalid_email`, `otp_invalid`, `otp_expired`, `domain_mismatch`, and `network_error`. Do not persist the email. Mock mode returns `unsupported` for OTP actions and null verification.

- [ ] **Step 4: Run focused tests**

Run: `npm run test -- src/features/campus/verification.spec.ts src/features/campus/campusSqlParity.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/campus/verification.ts src/features/campus/verification.spec.ts src/features/campus/types.ts src/features/campus/repository.ts src/features/campus/supabaseRepository.ts src/features/campus/mockRepository.ts
git commit -m "feat: add campus verification repository"
```

### Task 3: Store verification and recent live-battle state

**Files:**
- Modify: `src/features/campus/campusStore.ts`
- Create: `src/features/campus/campusStore.spec.ts`
- Modify: `src/features/campus/useCampusScreen.ts`
- Modify: `src/features/campus/outboxFlush.ts`

**Interfaces:**
- Consumes: `CampusVerification`, `CampusTileEvent`, and repository verification operations.
- Produces: `verification`, `verificationStatus`, `recentBattleEvents`, `startSchoolVerification`, `finishSchoolVerification`, and `canCampusContribute`.

- [ ] **Step 1: Write failing store tests**

```ts
it('keeps recent unique battle events newest first', () => {
  applyCampusSnapshot(snapshotWithEvents([capturedAt(1), reinforcedAt(2), capturedAt(1)]))
  expect(useCampusStore.getState().recentBattleEvents.map((event) => event.id))
    .toEqual(['reinforced-2', 'captured-1'])
})

it('blocks a nonmatching verified school', () => {
  useCampusStore.setState({ verification: { schoolId: 'yonsei', emailDomain: 'yonsei.ac.kr', verifiedAt: 1 } })
  expect(canCampusContribute('snu')).toBe(false)
  expect(canCampusContribute('yonsei')).toBe(true)
})
```

- [ ] **Step 2: Run focused test**

Run: `npm run test -- src/features/campus/campusStore.spec.ts`

Expected: FAIL because verification and event-feed state are absent.

- [ ] **Step 3: Implement state and guard**

```ts
const RECENT_BATTLE_EVENT_LIMIT = 12

function newestUniqueEvents(events: CampusTileEvent[]): CampusTileEvent[] {
  const seen = new Set<string>()
  return [...events].sort((a, b) => b.at - a.at)
    .filter((event) => !seen.has(event.id) && seen.add(event.id))
    .slice(0, RECENT_BATTLE_EVENT_LIMIT)
}
```

Load verification after live repository initialization and refresh it after OTP completion. Derive `recentBattleEvents` from server snapshots. Before outbox submission, reject a missing/mismatched verification as a permanent `school_verification_required` reason; do not silently retry it. Preserve viewing, polling, and reconnection behavior.

- [ ] **Step 4: Run focused tests**

Run: `npm run test -- src/features/campus/campusStore.spec.ts src/features/campus/verification.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/campus/campusStore.ts src/features/campus/campusStore.spec.ts src/features/campus/useCampusScreen.ts src/features/campus/outboxFlush.ts
git commit -m "feat: expose verified campus battle state"
```

### Task 4: Build verified-school and live battle UI

**Files:**
- Create: `src/components/campus/SchoolVerification.tsx`
- Create: `src/components/campus/SchoolVerification.spec.tsx`
- Create: `src/components/campus/CampusBattleFeed.tsx`
- Modify: `src/components/campus/SchoolPicker.tsx`
- Modify: `src/components/campus/CampusPanels.tsx`
- Modify: `src/components/campus/TerritoryMap.tsx`
- Modify: `src/app/routes/Campus.tsx`

**Interfaces:**
- Consumes: store OTP actions, verification status, recent events, `useSchoolIdentity`, and `useReducedMotion`.
- Produces: two-step verification UX, verified badge, live event region, and text/icon-backed map state.

- [ ] **Step 1: Write failing component tests**

```tsx
it('does not show contribution-ready state before verification', () => {
  render(<SchoolVerification schoolId="snu" schoolName="서울대학교" />)
  expect(screen.getByText('학교 이메일 인증이 필요해요')).toBeVisible()
  expect(screen.queryByText('영토전에 참여할 수 있어요')).not.toBeInTheDocument()
})

it('renders captured, contested, and reinforced events with words as well as color', () => {
  render(<CampusBattleFeed events={[capturedEvent, contestedEvent, reinforcedEvent]} tiles={tiles} />)
  expect(screen.getByText(/점령했어요/)).toBeVisible()
  expect(screen.getByText(/경합을 시작했어요/)).toBeVisible()
  expect(screen.getByText(/방어를 보강했어요/)).toBeVisible()
})
```

- [ ] **Step 2: Run focused UI test**

Run: `npm run test -- src/components/campus/SchoolVerification.spec.tsx`

Expected: FAIL because the components are absent.

- [ ] **Step 3: Implement UI**

Render an email form followed by a six-digit `autoComplete="one-time-code"` form. Show retryable Korean messages per typed reason and never render a full email after submission. Preset school selection opens this control; only after successful verification call the existing school-selection action. Custom selection keeps the current theme-only behavior and explains it cannot join the territory game.

Render `CampusBattleFeed` with `role="region"`, accessible name `실시간 영토전 소식`, and `aria-live="polite"`. For captured, contested, and reinforced events, include school short names, territory name, a text verb, and timestamp. Add text `경합` marker alongside existing map progress; preserve non-color labels and omit flash animation under reduced motion. Place the feed beside standings and update campus contribution copy to state that verified-school membership is required.

- [ ] **Step 4: Run focused UI tests**

Run: `npm run test -- src/components/campus/SchoolVerification.spec.tsx src/features/campus/campusScreens.spec.tsx src/features/campus/campusFlagOff.spec.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/campus/SchoolVerification.tsx src/components/campus/SchoolVerification.spec.tsx src/components/campus/CampusBattleFeed.tsx src/components/campus/SchoolPicker.tsx src/components/campus/CampusPanels.tsx src/components/campus/TerritoryMap.tsx src/app/routes/Campus.tsx
git commit -m "feat: show campus verification and live battles"
```

### Task 5: Full verification and handoff

**Files:**
- Modify: `e2e/campus.spec.ts`
- Modify: `README.md`
- Modify: `docs/14_DATA_PRIVACY_SECURITY.md`

**Interfaces:**
- Consumes: implementation from Tasks 1–4 and an isolated Supabase project with Email OTP enabled.
- Produces: regression tests and operational/privacy documentation.

- [ ] **Step 1: Add browser regression tests**

```ts
test('unverified visitor can inspect but cannot participate', async ({ page }) => {
  await page.goto('/campus')
  await expect(page.getByText('학교 이메일 인증이 필요해요')).toBeVisible()
  await expect(page.getByTestId('territory-map')).toBeVisible()
})

test('the live battle feed is available to map viewers', async ({ page }) => {
  await page.goto('/campus')
  await expect(page.getByRole('region', { name: '실시간 영토전 소식' })).toBeVisible()
})
```

- [ ] **Step 2: Update documentation**

Document that OTP is only for school authorization, raw email remains in Supabase Auth, only verified students can write territory data, and camera/posture data remains excluded. List the migration after the team's baseline SQL run order. Do not claim a specific email domain until its seed row has been reviewed.

- [ ] **Step 3: Run required checks**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e -- e2e/campus.spec.ts
```

Expected: all pass. With two browser sessions and approved test domains, manually confirm code delivery, denied unverified contribution, matching-school contribution, and a live capture event.

- [ ] **Step 4: Commit and hand off SQL**

```bash
git add e2e/campus.spec.ts README.md docs/14_DATA_PRIVACY_SECURITY.md
git commit -m "test: cover verified live campus battles"
git status --short
```

Hand the teammate the exact final migration path: `supabase/migrations/20260730_campus_school_verification.sql`. Never apply it to the shared production server.

## Plan self-review

- Spec coverage: Tasks 1–2 cover domain mapping, OTP, RLS, and email minimization; Task 3 blocks unverified writes and makes a bounded server-event feed; Task 4 covers visual identity, accessibility, realtime fight visibility, and recovery UX; Task 5 covers test and operational handoff.
- Scope: custom schools remain view/theme only; no official university assets, anonymous contribution migration, or camera-data flow is introduced.
- Type consistency: `CampusVerification` is the shared model; repository and store APIs use the same request/confirm/fetch naming.

