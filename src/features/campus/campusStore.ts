import { create } from 'zustand'
import { isRoomConfigured } from '@/lib/supabase/client'
import { parseFlag } from '@/lib/feature-flags/flags'
import { MockCampusRepository, type CampusIdentity } from './mockRepository'
import { SupabaseCampusRepository } from './supabaseRepository'
import { getCampusMemberId } from './identity'
import { useCampusThemeStore } from './campusThemeStore'
import { useCampusDirectoryStore } from './schoolDirectory'
import { useDemoStore } from '@/features/demo/demoMode'
import { rankStandings } from './contribution'
import { seasonAt } from './season'
import { createSeasonMap } from './campusMap'
import { outboxCount } from './outbox'
import type { CampusRepository, CampusSubmitResult } from './repository'
import type { CampusRealtimeStatus, CampusSnapshot, CampusTileEvent, CampusVerification } from './types'

/**
 * 캠퍼스 영토전 화면 상태.
 *
 * 저장소는 `CampusRepository` 하나로 추상화되어 있습니다. 단,
 * `VITE_ENABLE_CAMPUS_SUPABASE=true` 인 live 모드에서는 어떤 실패에도
 * mock 으로 자동 전환하지 않습니다(§6-F) — source 는 supabase 를 유지하고
 * 상태(error/reconnecting)와 마지막 snapshot 을 보존한 채 재시도합니다.
 * mock 은 플래그가 꺼진 개발·프리뷰 환경 전용입니다.
 */
export type CampusStatus = 'idle' | 'loading' | 'ready' | 'error'

interface CampusStoreState {
  status: CampusStatus
  source: 'mock' | 'supabase' | null
  snapshot: CampusSnapshot | null
  /** 방금 점령된 타일 — 색상 변화 애니메이션 트리거 */
  flashTileIds: string[]
  errorMessage: string | null
  /** 실제 Realtime 구독 상태 — SUBSCRIBED 확인 후에만 connected */
  realtimeStatus: CampusRealtimeStatus
  /** 마지막으로 서버 snapshot 을 성공적으로 받은 시각 */
  lastSyncedAt: number | null
  /** 마지막 Realtime 이벤트 수신 시각 */
  lastRealtimeEventAt: number | null
  /** 마지막으로 내 기여가 서버에 반영된 시각 */
  lastAcceptedAt: number | null
  /** 아직 서버에 반영되지 못한 기여 수 (outbox) */
  pendingContributionCount: number
  verification: CampusVerification | null
  recentBattleEvents: CampusTileEvent[]
}

const RECENT_BATTLE_EVENT_LIMIT = 12

/** 서버가 보낸 이벤트만, 중복 없이 최신순으로 화면에 보관합니다. */
export function newestCampusBattleEvents(events: CampusTileEvent[]): CampusTileEvent[] {
  const seen = new Set<string>()
  return [...events]
    .sort((a, b) => b.at - a.at)
    .filter((event) => !seen.has(event.id) && seen.add(event.id))
    .slice(0, RECENT_BATTLE_EVENT_LIMIT)
}

const emptySnapshot = (now: number): CampusSnapshot => {
  const season = seasonAt(now)
  return {
    season,
    tiles: createSeasonMap(season.id, now),
    standings: [],
    tileEvents: [],
    myContribution: 0,
    archived: [],
  }
}

export const useCampusStore = create<CampusStoreState>(() => ({
  status: 'idle',
  source: null,
  snapshot: null,
  flashTileIds: [],
  errorMessage: null,
  realtimeStatus: 'connecting',
  lastSyncedAt: null,
  lastRealtimeEventAt: null,
  lastAcceptedAt: null,
  pendingContributionCount: 0,
  verification: null,
  recentBattleEvents: [],
}))

let repository: CampusRepository | null = null
let unsubscribe: (() => void) | null = null
let flashTimer: number | null = null
let pollTimer: number | null = null
let browserListenersOn = false
/** 캠퍼스 화면이 열려 있는 동안만 폴백 polling 을 합니다. */
let campusScreenOpen = false

const POLL_INTERVAL_MS = 10_000

function identity(): CampusIdentity {
  return {
    memberId: getCampusMemberId(),
    schoolId: useCampusThemeStore.getState().schoolId,
  }
}

export function useSupabaseRepository(): boolean {
  return (
    parseFlag(import.meta.env.VITE_ENABLE_CAMPUS_SUPABASE, false) && isRoomConfigured()
  )
}

function createRepository(): CampusRepository {
  return useSupabaseRepository()
    ? new SupabaseCampusRepository()
    : new MockCampusRepository(identity)
}

/** 점령된 타일을 잠깐 강조합니다. (색상 변화 애니메이션) */
function flash(tileIds: string[]): void {
  if (tileIds.length === 0) return
  useCampusStore.setState((s) => ({
    flashTileIds: [...new Set([...s.flashTileIds, ...tileIds])],
  }))
  if (flashTimer) window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => {
    useCampusStore.setState({ flashTileIds: [] })
    flashTimer = null
  }, 1200)
}

function applySnapshot(next: CampusSnapshot): void {
  const previous = useCampusStore.getState().snapshot
  const changed: string[] = []
  if (previous && previous.season.id === next.season.id) {
    const before = new Map(previous.tiles.map((t) => [t.id, t.ownerSchoolId]))
    for (const tile of next.tiles) {
      if (before.has(tile.id) && before.get(tile.id) !== tile.ownerSchoolId) {
        changed.push(tile.id)
      }
    }
  }
  useCampusStore.setState({
    snapshot: next,
    recentBattleEvents: newestCampusBattleEvents(next.tileEvents),
    status: 'ready',
    errorMessage: null,
    lastSyncedAt: Date.now(),
  })
  flash(changed)
}

function onRealtimeStatus(
  status: CampusRealtimeStatus,
  meta?: { lastEventAt?: number },
): void {
  useCampusStore.setState((s) => ({
    realtimeStatus: status,
    lastRealtimeEventAt: meta?.lastEventAt ?? s.lastRealtimeEventAt,
  }))
  if (status === 'connected') {
    // 재연결 직후 대기 중 기여를 재전송합니다.
    void import('./outboxFlush').then((m) => m.flushCampusOutbox())
  }
  syncPolling()
}

/** Realtime 이 연결되어 있지 않을 때만 도는 유실 방지 polling (§6-E) */
function syncPolling(): void {
  const { realtimeStatus, source } = useCampusStore.getState()
  const shouldPoll =
    source === 'supabase' &&
    campusScreenOpen &&
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    realtimeStatus !== 'connected'
  if (shouldPoll && !pollTimer) {
    pollTimer = window.setInterval(() => {
      void refreshCampus()
    }, POLL_INTERVAL_MS)
  } else if (!shouldPoll && pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

export function setCampusScreenOpen(open: boolean): void {
  campusScreenOpen = open
  syncPolling()
}

function handleOnline(): void {
  const repo = repository
  if (repo instanceof SupabaseCampusRepository) repo.reconnectNow()
  void refreshCampus()
  void import('./outboxFlush').then((m) => m.flushCampusOutbox())
}

function handleVisibleOrFocus(): void {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    syncPolling()
    return
  }
  void refreshCampus()
  syncPolling()
}

function attachBrowserListeners(): void {
  if (browserListenersOn || typeof window === 'undefined') return
  browserListenersOn = true
  window.addEventListener('online', handleOnline)
  window.addEventListener('focus', handleVisibleOrFocus)
  document.addEventListener('visibilitychange', handleVisibleOrFocus)
}

function detachBrowserListeners(): void {
  if (!browserListenersOn || typeof window === 'undefined') return
  browserListenersOn = false
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('focus', handleVisibleOrFocus)
  document.removeEventListener('visibilitychange', handleVisibleOrFocus)
}

/** outbox 개수를 화면 상태로 반영합니다. */
export function syncPendingCount(): void {
  useCampusStore.setState({ pendingContributionCount: outboxCount() })
}

/**
 * 서버 snapshot 재조회. 실패해도 마지막 snapshot 을 유지하고
 * 원인 코드를 상태로 남깁니다(§6-G — 조용한 무시 금지).
 */
export async function refreshCampus(): Promise<void> {
  if (!repository) return
  try {
    applySnapshot(await repository.load())
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown'
    // eslint-disable-next-line no-console
    console.warn('[campus] snapshot refresh failed:', code)
    useCampusStore.setState((s) => ({
      // 마지막 snapshot 이 있으면 화면은 유지, 없으면 error 상태
      status: s.snapshot ? s.status : 'error',
      errorMessage: s.snapshot ? s.errorMessage : '캠퍼스 데이터를 불러오지 못했어요.',
    }))
  }
}

/** 화면 진입 시 호출합니다. 여러 번 불려도 저장소는 하나만 만듭니다. */
export async function initCampus(): Promise<void> {
  if (repository) {
    // 학교가 바뀐 뒤 다시 들어오면 내 기여도가 새 학교 기준으로 갱신되어야 합니다.
    await refreshCampus()
    return
  }

  useCampusStore.setState({ status: 'loading', errorMessage: null })
  const repo = createRepository()
  repository = repo
  useCampusStore.setState({
    source: repo.kind,
    realtimeStatus: repo.kind === 'supabase' ? 'connecting' : 'connected',
  })
  attachBrowserListeners()
  syncPendingCount()

  /*
    §6-A 초기화 순서 — load(내부에서 익명 로그인) 가 먼저,
    Realtime 구독은 인증이 끝난 다음입니다.
  */
  if (repo.kind === 'supabase') {
    // 디렉터리·membership 은 snapshot 과 병렬로 — 실패해도 지도는 뜹니다.
    void repo
      .loadDirectory?.()
      .then((entries) => useCampusDirectoryStore.getState().setEntries(entries))
      .catch(() => {})
    void import('./membershipRestore').then((m) => m.restoreMembershipFromServer(repo))
    void repo.fetchMyVerification?.().then((verification) => useCampusStore.setState({ verification }))

    try {
      applySnapshot(await repo.load())
    } catch (error) {
      /*
        §6-F — live 모드에서 mock 으로 내려가지 않습니다.
        마지막 snapshot 이 없으면 빈 96칸 지도를 배경으로 두고 error 를
        표시하며, 사용자는 재시도(refreshCampus)할 수 있습니다.
      */
      const code = error instanceof Error ? error.message : 'unknown'
      // eslint-disable-next-line no-console
      console.warn('[campus] live load failed:', code)
      useCampusStore.setState({
        status: 'error',
        snapshot: useCampusStore.getState().snapshot ?? emptySnapshot(Date.now()),
        errorMessage: '서버와 동기화하지 못했어요. 연결되면 자동으로 다시 시도해요.',
        realtimeStatus:
          typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error',
      })
    }
    unsubscribe = repo.subscribe(applySnapshot, onRealtimeStatus)
    void import('./outboxFlush').then((m) => m.flushCampusOutbox())
    syncPolling()
    return
  }

  // mock 경로 (플래그 OFF 전용)
  unsubscribe = repo.subscribe(applySnapshot, onRealtimeStatus)
  try {
    applySnapshot(await repo.load())
  } catch {
    useCampusStore.setState({
      status: 'error',
      snapshot: emptySnapshot(Date.now()),
      errorMessage: '캠퍼스 데이터를 불러오지 못했어요.',
    })
  }
}

/**
 * 기여 RPC 성공 응답의 권위값을 즉시 화면에 반영합니다(§5-B).
 * Realtime 이벤트를 기다리지 않으며, 이후 background refresh 가 전체
 * snapshot 을 재확인합니다.
 */
export function applyAuthoritativeResult(result: CampusSubmitResult): void {
  const state = useCampusStore.getState()
  if (!state.snapshot) return
  const snapshot = state.snapshot

  const myContribution =
    typeof result.authoritativeMyContribution === 'number'
      ? result.authoritativeMyContribution
      : snapshot.myContribution + result.points

  let tiles = snapshot.tiles
  if (result.updatedTile) {
    const updated = result.updatedTile
    tiles = snapshot.tiles.map((t) => (t.id === updated.id ? updated : t))
  }

  useCampusStore.setState({
    snapshot: { ...snapshot, myContribution, tiles },
    lastAcceptedAt: Date.now(),
  })
  if (result.captured && result.tileId) flash([result.tileId])
  syncPendingCount()

  // 배경 재확인 — 서버 전체 상태(순위·이벤트 로그 포함)와 맞춥니다.
  void refreshCampus()
}

export function getCampusRepository(): CampusRepository | null {
  return repository
}

export function disposeCampus(): void {
  unsubscribe?.()
  unsubscribe = null
  repository?.dispose()
  repository = null
  campusScreenOpen = false
  detachBrowserListeners()
  if (flashTimer) {
    window.clearTimeout(flashTimer)
    flashTimer = null
  }
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
  useCampusStore.setState({
    status: 'idle',
    source: null,
    snapshot: null,
    flashTileIds: [],
    errorMessage: null,
    realtimeStatus: 'connecting',
    lastSyncedAt: null,
    lastRealtimeEventAt: null,
    lastAcceptedAt: null,
    pendingContributionCount: 0,
    verification: null,
    recentBattleEvents: [],
  })
}

/* -------------------------------- 선택자 --------------------------------- */

export function selectRankedStandings(state: CampusStoreState) {
  return rankStandings(state.snapshot?.standings ?? [])
}

export function selectMyTileCount(state: CampusStoreState, schoolId: string | null): number {
  if (!schoolId || !state.snapshot) return 0
  return state.snapshot.tiles.filter((t) => t.ownerSchoolId === schoolId).length
}

/**
 * 학교 선택을 서버 membership 에 동기화합니다.
 * - mock 저장소: 서버가 없으므로 항상 'unchanged' (로컬 제한만 사용)
 * - supabase: 커스텀 학교면 stable key 로 먼저 서버 등록 후 membership 선택.
 *   서버 결과(change_limit 등)를 그대로 돌려 로컬 확정/롤백에 사용합니다.
 */
export async function syncSchoolSelection(
  schoolId: string,
): Promise<
  | 'selected' | 'changed' | 'unchanged' | 'change_limit' | 'change_cooldown'
  | 'ownership_conflict' | 'name_conflict' | 'not_ready'
> {
  if (!repository || repository.kind !== 'supabase') return 'unchanged'
  // 데모 모드의 임시 선택은 서버 membership 에 기록하지 않습니다.
  if (useDemoStore.getState().isDemo) return 'unchanged'
  const repo = repository as SupabaseCampusRepository

  if (schoolId.startsWith('custom-')) {
    // 이름·짧은 이름·색이 검증된 뒤에만 호출됩니다 (saveCustomSchool).
    const theme = useCampusThemeStore.getState()
    const upserted = await repo.upsertCustomSchool(
      schoolId,
      theme.customSchoolName,
      theme.customSchoolShortName,
      theme.customColor,
    )
    // existing = 다른 사용자가 만든 같은 학교 — 참여는 허용됩니다.
    if (upserted === 'ownership_conflict' || upserted === 'name_conflict') {
      return upserted
    }
    if (
      upserted !== 'created' &&
      upserted !== 'updated' &&
      upserted !== 'existing'
    ) {
      return 'not_ready'
    }
    // 디렉터리를 곧바로 당겨 와 내 학교가 모든 화면에서 이름으로 보이게 합니다.
    void repo
      .loadDirectory?.()
      .then((entries) => useCampusDirectoryStore.getState().setEntries(entries))
      .catch(() => {})
  }
  return (await repo.selectSchool?.(schoolId)) ?? 'not_ready'
}
