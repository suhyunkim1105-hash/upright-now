import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { ensureAnonymousUser, getSupabase } from '@/lib/supabase/client'
import { CONTRIBUTION_POINTS, withNormalizedScore } from './contribution'
import { countTilesBySchool } from './territory'
import { CAMPUS_GRID_SEED } from './campusGridOverlay'
import { useCampusDirectoryStore } from './schoolDirectory'
import type { CampusRepository, CampusSubmitResult } from './repository'
import type {
  CampusArchivedSeason,
  CampusContributionEvent,
  CampusRealtimeStatus,
  CampusSchoolDirectoryEntry,
  CampusSchoolStanding,
  CampusSeason,
  CampusSnapshot,
  CampusTile,
  CampusTileEvent,
  CampusVerification,
} from './types'

/**
 * Supabase 저장소 — supabase/migrations/20260727_campus_final_grid_realtime.sql
 * 과 짝을 이룹니다.
 *
 * 전송하는 것: 학교 id · 시즌 id · 영토 id · 기여 종류 · eventId · sessionId 뿐.
 * 카메라 영상·프레임·랜드마크·자세 좌표·`bad` 상태는 전송하지 않습니다.
 *
 * Realtime 규약(§6):
 * - 익명 로그인 → access token 을 realtime 소켓에 setAuth → 구독.
 *   (JWT 없는 소켓은 RLS 테이블의 postgres_changes 를 받지 못합니다)
 * - SUBSCRIBED 확인 후에만 connected 를 알립니다.
 * - CHANNEL_ERROR/TIMED_OUT/CLOSED → 지수 backoff 재구독, 성공 시 전체 reload.
 * - live 모드에서 mock 으로 자동 전환하지 않습니다(캠퍼스 스토어 참조).
 */
const ARCHIVED_DETAIL_LIMIT = 3
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30_000

interface TileRow {
  id: string
  season_id: string
  x: number
  y: number
  zone: string
  name?: string | null
  owner_school_id: string | null
  challenger_school_id: string | null
  defense_score: number
  challenge_score: number
  updated_at: string
}

interface TileEventRow {
  id: string
  season_id: string
  territory_id: string
  kind: string
  from_school_id: string | null
  to_school_id: string | null
  created_at: string
}

interface SeasonRow {
  id: string
  name: string
  starts_at: string
  ends_at: string
  status: string
}

interface StandingRow {
  school_id: string
  total_contribution: number
  active_contributors: number
  tiles: number
}

interface DirectoryRow {
  id: string
  display_name: string
  short_name: string
  color: string
  is_custom: boolean
}

const seedByXY = new Map(CAMPUS_GRID_SEED.map((s) => [`${s.x},${s.y}`, s]))

function toTile(row: TileRow): CampusTile {
  const seed = seedByXY.get(`${row.x},${row.y}`)
  return {
    id: row.id,
    seasonId: row.season_id,
    x: row.x,
    y: row.y,
    zone: (row.zone || seed?.zone || 'lawn') as CampusTile['zone'],
    name: row.name ?? seed?.name ?? `${row.y + 1}행 ${row.x + 1}열`,
    ownerSchoolId: row.owner_school_id,
    challengerSchoolId: row.challenger_school_id,
    defenseScore: row.defense_score,
    challengeScore: row.challenge_score,
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

function toSeason(row: SeasonRow): CampusSeason {
  return {
    id: row.id,
    name: row.name,
    startsAt: new Date(row.starts_at).getTime(),
    endsAt: new Date(row.ends_at).getTime(),
    status: row.status === 'archived' ? 'archived' : 'active',
  }
}

function toTileEvent(row: TileEventRow): CampusTileEvent {
  return {
    id: row.id,
    seasonId: row.season_id,
    tileId: row.territory_id,
    kind: row.kind as CampusTileEvent['kind'],
    fromSchoolId: row.from_school_id,
    toSchoolId: row.to_school_id,
    at: new Date(row.created_at).getTime(),
  }
}

function toDirectoryEntry(row: DirectoryRow): CampusSchoolDirectoryEntry {
  return {
    id: row.id,
    displayName: row.display_name,
    shortName: row.short_name,
    color: row.color,
    isCustom: Boolean(row.is_custom),
  }
}

export class SupabaseCampusRepository implements CampusRepository {
  readonly kind = 'supabase' as const

  private channel: RealtimeChannel | null = null
  private listeners = new Set<(snapshot: CampusSnapshot) => void>()
  private statusListeners = new Set<
    (status: CampusRealtimeStatus, meta?: { lastEventAt?: number }) => void
  >()
  private last: CampusSnapshot | null = null
  private archivedCache: { key: string; value: CampusArchivedSeason[] } | null = null
  private reconnectAttempts = 0
  private reconnectTimer: number | null = null
  private disposed = false

  private emitStatus(status: CampusRealtimeStatus, meta?: { lastEventAt?: number }): void {
    for (const cb of this.statusListeners) cb(status, meta)
  }

  async fetchMyVerification(): Promise<CampusVerification | null> {
    const supabase = await getSupabase()
    if (!supabase) return null
    const { data, error } = await supabase.rpc('campus_my_verification')
    if (error) return null
    const row = Array.isArray(data) ? data[0] : null
    if (!row?.school_id || !row.email_domain || !row.verified_at) return null
    return {
      schoolId: row.school_id as string,
      emailDomain: row.email_domain as string,
      verifiedAt: new Date(row.verified_at as string).getTime(),
    }
  }

  async requestSchoolVerification(
    email: string,
  ): Promise<'sent' | 'invalid_email' | 'network_error'> {
    const supabase = await getSupabase()
    if (!supabase) return 'network_error'
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    return error ? 'network_error' : 'sent'
  }

  async confirmSchoolVerification(
    schoolId: string,
    email: string,
    token: string,
  ): Promise<'verified' | 'otp_invalid' | 'otp_expired' | 'domain_mismatch' | 'network_error'> {
    const supabase = await getSupabase()
    if (!supabase) return 'network_error'
    const { error: otpError } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (otpError) {
      return /expired/i.test(otpError.message) ? 'otp_expired' : 'otp_invalid'
    }
    const { data, error } = await supabase.rpc('campus_verify_school', { p_school_id: schoolId })
    if (error) return 'network_error'
    const row = Array.isArray(data) ? data[0] : null
    if (row?.verified === true) return 'verified'
    return row?.reason === 'domain_mismatch' ? 'domain_mismatch' : 'network_error'
  }

  async load(): Promise<CampusSnapshot> {
    const supabase = await getSupabase()
    if (!supabase) throw new Error('supabase-not-configured')
    await ensureAnonymousUser()
    // 시즌 자동 전환 — 14일 경계에서도 새 시즌·96영토가 준비됩니다.
    try {
      await supabase.rpc('ensure_active_campus_season')
    } catch {
      /* 마이그레이션 전 — 조회는 계속 진행 */
    }

    const { data: seasonRow } = await supabase
      .from('campus_seasons')
      .select('id, name, starts_at, ends_at, status')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!seasonRow) throw new Error('no-active-season')
    const season = toSeason(seasonRow as SeasonRow)

    const [tiles, events, standings, mine, archived] = await Promise.all([
      supabase
        .from('campus_territories')
        .select(
          'id, season_id, x, y, zone, name, owner_school_id, challenger_school_id, defense_score, challenge_score, updated_at',
        )
        .eq('season_id', season.id),
      supabase
        .from('campus_territory_events')
        .select('id, season_id, territory_id, kind, from_school_id, to_school_id, created_at')
        .eq('season_id', season.id)
        .order('created_at', { ascending: false })
        .limit(60),
      supabase.rpc('campus_season_standings', { p_season_id: season.id }),
      supabase.rpc('campus_my_contribution', { p_season_id: season.id }),
      supabase
        .from('campus_seasons')
        .select('id, name, starts_at, ends_at, status')
        .eq('status', 'archived')
        .order('starts_at', { ascending: false })
        .limit(8),
    ])

    // 조용한 실패 금지 — 타일 조회가 실패하면 snapshot 을 만들지 않습니다.
    if (tiles.error) throw new Error('tiles-load-failed:' + tiles.error.code)

    const tileList = ((tiles.data ?? []) as TileRow[]).map(toTile)
    const tileCounts = countTilesBySchool(tileList)
    const standingList: CampusSchoolStanding[] = (
      (standings.data ?? []) as StandingRow[]
    ).map((row) =>
      withNormalizedScore({
        schoolId: row.school_id,
        totalContribution: row.total_contribution,
        activeContributors: row.active_contributors,
        tiles: tileCounts[row.school_id] ?? 0,
      }),
    )

    const archivedRows = ((archived.data ?? []) as SeasonRow[]).slice(
      0,
      ARCHIVED_DETAIL_LIMIT,
    )
    const archivedKey = archivedRows.map((r) => r.id).join(',')
    let archivedList: CampusArchivedSeason[]
    if (this.archivedCache?.key === archivedKey) {
      archivedList = this.archivedCache.value
    } else {
      archivedList = await Promise.all(
        archivedRows.map(async (row) => {
          const archivedSeason = toSeason(row)
          const [archivedTiles, archivedStandings] = await Promise.all([
            supabase
              .from('campus_territories')
              .select(
                'id, season_id, x, y, zone, name, owner_school_id, challenger_school_id, defense_score, challenge_score, updated_at',
              )
              .eq('season_id', archivedSeason.id),
            supabase.rpc('campus_season_standings', { p_season_id: archivedSeason.id }),
          ])
          const tilesOfSeason = ((archivedTiles.data ?? []) as TileRow[]).map(toTile)
          const counts = countTilesBySchool(tilesOfSeason)
          return {
            season: archivedSeason,
            tiles: tilesOfSeason,
            standings: ((archivedStandings.data ?? []) as StandingRow[]).map((s) =>
              withNormalizedScore({
                schoolId: s.school_id,
                totalContribution: s.total_contribution,
                activeContributors: s.active_contributors,
                tiles: counts[s.school_id] ?? 0,
              }),
            ),
          }
        }),
      )
      this.archivedCache = { key: archivedKey, value: archivedList }
    }

    const snapshot: CampusSnapshot = {
      season,
      tiles: tileList,
      standings: standingList,
      tileEvents: ((events.data ?? []) as TileEventRow[]).map(toTileEvent),
      myContribution: typeof mine.data === 'number' ? mine.data : 0,
      archived: archivedList,
    }
    this.last = snapshot
    return snapshot
  }

  /** 안전한 학교 디렉터리 — 신 테이블 우선, 마이그레이션 전이면 기존 뷰 */
  async loadDirectory(): Promise<CampusSchoolDirectoryEntry[]> {
    const supabase = await getSupabase()
    if (!supabase) return []
    await ensureAnonymousUser()
    const fromTable = await supabase
      .from('campus_school_directory_entries')
      .select('id, display_name, short_name, color, is_custom')
    if (!fromTable.error) {
      return ((fromTable.data ?? []) as DirectoryRow[]).map(toDirectoryEntry)
    }
    const fromView = await supabase
      .from('campus_school_directory')
      .select('id, display_name, short_name, color, is_custom')
    if (fromView.error) return []
    return ((fromView.data ?? []) as DirectoryRow[]).map(toDirectoryEntry)
  }

  async fetchMyMembership(): Promise<{ schoolId: string } | null> {
    const supabase = await getSupabase()
    if (!supabase) return null
    await ensureAnonymousUser()
    const { data, error } = await supabase.rpc('campus_my_membership')
    if (error) return null
    const row = data as { school_id?: string | null } | null
    return row?.school_id ? { schoolId: row.school_id } : null
  }

  subscribe(
    listener: (snapshot: CampusSnapshot) => void,
    onStatus?: (status: CampusRealtimeStatus, meta?: { lastEventAt?: number }) => void,
  ): () => void {
    this.listeners.add(listener)
    if (onStatus) this.statusListeners.add(onStatus)

    if (!this.channel && !this.reconnectTimer) {
      this.emitStatus('connecting')
      void this.connect()
    }

    return () => {
      this.listeners.delete(listener)
      if (onStatus) this.statusListeners.delete(onStatus)
    }
  }

  /**
   * §6-A 초기화 순서: 익명 로그인 → 세션 토큰 → realtime.setAuth → 구독.
   * 인증 전 unauthenticated 채널을 먼저 열지 않습니다.
   */
  private async connect(): Promise<void> {
    if (this.disposed) return
    const supabase = await getSupabase()
    if (!supabase) {
      this.emitStatus('error')
      return
    }
    try {
      await ensureAnonymousUser()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) supabase.realtime.setAuth(token)
      this.openChannel(supabase)
    } catch {
      this.scheduleReconnect()
    }
  }

  private openChannel(supabase: SupabaseClient): void {
    if (this.disposed) return
    // 중복 채널 0 — 기존 채널을 반드시 정리하고 새로 엽니다.
    if (this.channel) {
      void supabase.removeChannel(this.channel)
      this.channel = null
    }

    const onEvent = () => {
      this.emitStatus('connected', { lastEventAt: Date.now() })
      void this.refresh()
    }

    this.channel = supabase
      .channel('campus-territory')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campus_territories' },
        onEvent,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'campus_territory_events' },
        onEvent,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campus_school_directory_entries' },
        (payload) => {
          // 디렉터리는 전체 reload 없이 그 자리에서 반영합니다.
          const store = useCampusDirectoryStore.getState()
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { id?: string }
            if (old?.id) store.removeEntry(old.id)
          } else {
            const row = payload.new as DirectoryRow
            if (row?.id) store.upsertEntry(toDirectoryEntry(row))
          }
          this.emitStatus('connected', { lastEventAt: Date.now() })
        },
      )
      .subscribe((status) => {
        if (this.disposed) return
        if (status === 'SUBSCRIBED') {
          const hadFailures = this.reconnectAttempts > 0
          this.reconnectAttempts = 0
          this.emitStatus('connected')
          // 재연결 성공 — 끊긴 동안 놓친 변화를 전체 snapshot 으로 복구
          if (hadFailures) void this.refresh()
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          this.scheduleReconnect()
        }
      })
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer) return
    this.reconnectAttempts += 1
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** Math.min(this.reconnectAttempts - 1, 5),
    )
    this.emitStatus(
      typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'reconnecting',
    )
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, delay)
  }

  /** 브라우저 online/focus 복귀 등에서 즉시 재연결을 시도합니다. */
  reconnectNow(): void {
    if (this.disposed) return
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    void this.connect()
  }

  private async refresh(): Promise<void> {
    try {
      const snapshot = await this.load()
      for (const listener of this.listeners) listener(snapshot)
    } catch {
      /*
        조용히 삼키지 않습니다 — 마지막 snapshot 은 유지하되 상태를 알립니다.
        다음 이벤트·reconnect·online/focus refresh 에서 다시 시도합니다.
      */
      this.emitStatus('error')
      if (this.last) for (const listener of this.listeners) listener(this.last)
    }
  }

  async submitContribution(event: CampusContributionEvent): Promise<CampusSubmitResult> {
    const supabase = await getSupabase()
    if (!supabase) return { accepted: false, points: 0, reason: 'not_ready' }
    await ensureAnonymousUser()

    /*
      원자적 RPC (v3) — eventId 멱등성·점령 판정·모든 상한을 서버가 처리하고
      권위값(authoritativeMyContribution·updatedTerritory)을 함께 돌려줍니다.
      학교·멤버·점수는 클라이언트가 보내지 않습니다.
    */
    const { data, error } = await supabase.rpc('apply_campus_contribution', {
      p_event_id: event.eventId,
      p_territory_id: event.tileId ?? null,
      p_session_id: event.sessionId ?? null,
      p_kind: event.kind,
    })

    if (error) return { accepted: false, points: 0, reason: 'not_ready' }

    const row = data as {
      result?: string
      points?: number
      acceptedPoints?: number
      authoritativeMyContribution?: number
      territoryId?: string | null
      updatedTerritory?: TileRow | null
      serverTime?: string | null
    } | null
    const result = row?.result ?? 'not_ready'
    const accepted =
      result === 'accepted' || result === 'captured' ||
      result === 'contested' || result === 'defended' ||
      result === 'territory_not_found'

    const permanentRejects = new Set([
      'duplicate_event', 'duplicate_session', 'daily_cap', 'recovery_cap',
      'recovery_cooldown', 'no_membership', 'invalid_kind', 'session_required',
    ])

    const points = row?.acceptedPoints ?? row?.points ?? 0

    return {
      accepted,
      points: accepted ? (points || CONTRIBUTION_POINTS[event.kind]) : 0,
      captured: result === 'captured',
      contested: result === 'contested',
      tileId: row?.territoryId ?? event.tileId,
      authoritativeMyContribution:
        typeof row?.authoritativeMyContribution === 'number'
          ? row.authoritativeMyContribution
          : undefined,
      updatedTile: row?.updatedTerritory ? toTile(row.updatedTerritory) : null,
      serverTime: row?.serverTime ? new Date(row.serverTime).getTime() : undefined,
      reason: accepted
        ? undefined
        : permanentRejects.has(result)
          ? (result as CampusSubmitResult['reason'])
          : 'not_ready',
    }
  }

  /** 커스텀 학교 등록/수정 — 서버가 소유권·이름 충돌을 판정합니다. */
  async upsertCustomSchool(
    id: string,
    displayName: string,
    shortName: string,
    color: string,
  ): Promise<
    | 'created' | 'updated' | 'existing'
    | 'name_conflict' | 'ownership_conflict' | 'invalid' | 'not_ready'
  > {
    const supabase = await getSupabase()
    if (!supabase) return 'not_ready'
    await ensureAnonymousUser()
    const { data, error } = await supabase.rpc('upsert_custom_school', {
      p_id: id,
      p_display_name: displayName,
      p_short_name: shortName,
      p_color: color,
    })
    if (error) return 'not_ready'
    const result = (data as { result?: string } | null)?.result
    if (
      result === 'created' || result === 'updated' || result === 'existing' ||
      result === 'name_conflict' || result === 'ownership_conflict' ||
      result === 'invalid'
    ) {
      return result
    }
    return 'not_ready'
  }

  /** 서버 membership 갱신 — 다른 학교로의 기여 위조를 서버가 차단하는 기반 */
  async selectSchool(
    schoolId: string,
  ): Promise<
    | 'selected' | 'changed' | 'unchanged'
    | 'change_limit' | 'change_cooldown' | 'verification_required' | 'not_ready'
  > {
    const supabase = await getSupabase()
    if (!supabase) return 'not_ready'
    await ensureAnonymousUser()
    const { data, error } = await supabase.rpc('select_campus_school', {
      p_school_id: schoolId,
    })
    // 학교 선택은 이메일 인증 화면으로 진입하기 위한 로컬 테마 선택까지는
    // 허용합니다. 서버가 인증 전 membership 을 막으면 그 이유를 보존해
    // 호출부가 선택을 되돌리지 않고 인증 UI를 열 수 있게 합니다.
    if (error) {
      return /school_verification_required/i.test(error.message)
        ? 'verification_required'
        : 'not_ready'
    }
    const result = (data as { result?: string } | null)?.result
    if (
      result === 'selected' || result === 'changed' ||
      result === 'unchanged' || result === 'change_limit' ||
      result === 'change_cooldown'
    ) {
      return result
    }
    return 'not_ready'
  }

  dispose(): void {
    this.disposed = true
    this.listeners.clear()
    this.statusListeners.clear()
    this.archivedCache = null
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    void this.channel?.unsubscribe()
    this.channel = null
  }
}
