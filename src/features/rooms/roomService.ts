import type { RealtimeChannel } from '@supabase/supabase-js'
import { ensureAnonymousUser, getSupabase } from '@/lib/supabase/client'
import {
  generateRoomCode,
  sanitizeReactionText,
  sanitizeRoomEvent,
  ROOM_DAMAGE,
  ROOM_SHIELD_PER_STRETCH,
  type ReactionKind,
  type RoomEvent,
} from './roomEvents'
import { MAX_PERSISTENT_ROOMS, MAX_ROOM_MEMBERS } from '@/constants/rooms'
import { createGiraffeSync, deriveSyncEventId, registerRecovery } from './giraffeSync'
import { useRoomStore, type MemberState } from './roomStore'
import { useUserStore } from '@/features/onboarding/userStore'
import { xpToStage } from '@/features/progression/growth'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useCalibrationStore, hasValidActiveProfile } from '@/features/calibration/calibrationStore'
import { featureFlags } from '@/lib/feature-flags/flags'

/**
 * 친구 방 서비스 — Supabase 익명 인증 · RPC · Presence · Broadcast.
 *
 * 전송하는 것: 닉네임 · 참가 상태 · 성공 이벤트(회복/스트레칭/완료/응원)뿐입니다.
 * 카메라 영상·프레임·랜드마크·자세 좌표·bad 상태는 절대 전송하지 않습니다.
 * 보스 HP 는 DB(rooms.boss_hp)가 최종 기준이며 RPC 로만 원자적으로 줄입니다.
 */
let channel: RealtimeChannel | null = null
let giraffe = createGiraffeSync()
let reconnectTimer: number | null = null
let pollTimer: number | null = null
let heartbeatTimer: number | null = null
let reconnectDeadline = 0

const store = () => useRoomStore.getState()

function myPresence(state: MemberState) {
  const prog = useProgressionStore.getState()
  const user = useUserStore.getState()
  const cal = useCalibrationStore.getState()
  const cameraOn = featureFlags.camera
  return {
    participantId: store().myId ?? '',
    nickname: user.nickname,
    stage: xpToStage(prog.xp),
    state,
    isHost: store().isHost,
    jacketId: prog.equipped.jacketId,
    backpackId: prog.equipped.backpackId,
    // 준비 상태 — 자세 상태(good/bad 등)는 절대 넣지 않습니다.
    cameraReady: !cameraOn || store().myCameraReady,
    // 프로필 개수가 아니라 "유효한 활성 기준"을 요구합니다.
    calibrationReady: !cameraOn || hasValidActiveProfile(cal),
    // 감지 사전 점검(모델 로드 + 1.5초 유효 랜드마크) 통과 여부
    modelReady: !cameraOn || store().myModelReady,
    userReady: state === 'ready',
  }
}

async function refreshRoomRow(roomId: string): Promise<void> {
  const supabase = await getSupabase()
  if (!supabase) return
  // '*' 로 읽어 is_persistent 컬럼이 아직 없는(마이그레이션 전) DB 에서도
  // 조회가 깨지지 않게 합니다.
  const { data } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single()
  if (!data) return
  store().patch({
    bossHp: data.boss_hp,
    bossMaxHp: data.boss_max_hp,
    shield: data.shield ?? 0,
    durationSec: data.duration_seconds,
    isPersistent: Boolean(
      (data as { is_persistent?: boolean }).is_persistent,
    ),
    startedAt: data.started_at ? new Date(data.started_at).getTime() : null,
    phase:
      data.status === 'running'
        ? 'running'
        : data.status === 'completed' || data.status === 'closed'
          ? 'completed'
          : 'waiting',
  })
}

function handleEvent(event: RoomEvent): void {
  const s = store()
  if (event.type === 'reaction_sent' && event.reaction) {
    s.addReaction({
      id: event.id,
      participantId: event.participantId,
      nickname: event.nickname,
      reaction: event.reaction,
      reactionText: event.reactionText,
      at: Date.now(),
    })
    return
  }

  const isMine = event.participantId === s.myId

  // 성공 이벤트가 오면 곧 DB HP·방어막이 바뀌므로 잠시 후 재조회합니다.
  if (event.type !== 'reaction_sent' && s.roomId) {
    const roomId = s.roomId
    window.setTimeout(() => void refreshRoomRow(roomId), 800)
  }

  if (event.type === 'recovery_earned') {
    if (!isMine) {
      s.patch({
        lastFriendEvent: `${event.nickname}님이 회복 에너지를 보냈어요.`,
        friendAttackTick: s.friendAttackTick + 1,
      })
    }
    const result = registerRecovery(giraffe, {
      eventId: event.id,
      participantId: event.participantId,
      timestamp: event.timestamp,
    })
    giraffe = result.state
    if (result.sync && result.pairIds && s.roomId) {
      s.patch({ syncFlashAt: Date.now() })
      // 두 클라이언트가 같은 결정적 event_id(파생 uuid)로 호출 → DB 가 1회만 적용.
      // 원본 회복 id 를 재사용하면 dedup 테이블과 충돌하므로 파생 id 를 씁니다.
      const syncId = deriveSyncEventId(result.pairIds[0], result.pairIds[1])
      void applyDamageRpc(s.roomId, syncId, 'giraffe_sync', ROOM_DAMAGE.giraffeSync)
    }
    return
  }

  if (event.type === 'session_completed' && !isMine) {
    s.patch({ lastFriendEvent: `${event.nickname}님이 세션을 완주했어요.` })
  }
  if (event.type === 'stretch_completed' && !isMine) {
    s.patch({ lastFriendEvent: `${event.nickname}님이 스트레칭으로 방어막을 채웠어요.` })
  }
}

async function applyDamageRpc(
  roomId: string,
  eventId: string,
  eventType: 'recovery_earned' | 'session_completed' | 'giraffe_sync',
  damage: number,
): Promise<void> {
  const supabase = await getSupabase()
  if (!supabase) return
  const { data } = await supabase.rpc('apply_room_damage', {
    p_room_id: roomId,
    p_event_id: eventId,
    p_event_type: eventType,
    p_damage: damage,
  })
  if (typeof data === 'number') store().patch({ bossHp: data })
}

async function broadcast(event: RoomEvent): Promise<void> {
  const safe = sanitizeRoomEvent(event)
  if (!safe || !channel) return
  await channel.send({ type: 'broadcast', event: 'room_event', payload: safe })
}

function startPolling(roomId: string): void {
  if (pollTimer) window.clearInterval(pollTimer)
  // postgres_changes publication 이 없는 프로젝트에서도 상태·HP 가 따라오도록 폴링합니다.
  pollTimer = window.setInterval(() => {
    const phase = store().phase
    if (phase === 'waiting' || phase === 'running') void refreshRoomRow(roomId)
  }, 3000)
}

function startHeartbeat(roomId: string): void {
  if (heartbeatTimer) window.clearInterval(heartbeatTimer)
  heartbeatTimer = window.setInterval(() => {
    const phase = store().phase
    if (phase !== 'waiting' && phase !== 'running') return
    void (async () => {
      const supabase = await getSupabase()
      if (!supabase) return
      try {
        await supabase.rpc('heartbeat_room_member', { p_room_id: roomId })
        await supabase.rpc('cleanup_stale_members', { p_room_id: roomId })
      } catch {
        /* 마이그레이션 전 — 무시 */
      }
    })()
  }, 15_000)
}

function subscribeChannel(roomId: string, code: string): void {
  startPolling(roomId)
  startHeartbeat(roomId)
  void (async () => {
    const supabase = await getSupabase()
    if (!supabase) return

    channel = supabase.channel(`room:${code}`, {
      // private 채널은 realtime.messages RLS 정책이 필요합니다. 현재 스키마에는 없어
      // 표준 채널을 씁니다. 방 데이터 자체는 테이블 RLS + RPC 검증으로 보호됩니다.
      config: { presence: { key: store().myId ?? undefined } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const presence = channel?.presenceState() ?? {}
        // track() 재호출 시 메타가 누적될 수 있어 participantId 기준
        // "마지막 메타"만 남깁니다. (준비 상태 갱신이 옛 메타에 가려지는 것 방지)
        const byId = new Map<string, ReturnType<typeof myPresence>>()
        for (const raw of Object.values(presence).flat()) {
          const m = raw as unknown as ReturnType<typeof myPresence>
          if (m.participantId) byId.set(m.participantId, m)
        }
        const members = [...byId.values()].map((m) => ({
          participantId: m.participantId,
          nickname: m.nickname,
          stage: m.stage,
          state: m.state,
          isHost: m.isHost,
          jacketId: m.jacketId,
          backpackId: m.backpackId,
          cameraReady: Boolean(m.cameraReady),
          calibrationReady: Boolean(m.calibrationReady),
          modelReady: Boolean(m.modelReady),
          userReady: Boolean(m.userReady),
        }))
        store().patch({ members })
      })
      .on('broadcast', { event: 'room_event' }, ({ payload }) => {
        const safe = sanitizeRoomEvent(payload)
        if (safe) handleEvent(safe)
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => void refreshRoomRow(roomId),
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          store().patch({ connection: 'connected' })
          await channel?.track(myPresence('joining'))
          await refreshRoomRow(roomId)
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleReconnect(roomId, code)
        }
      })
  })()
}

/** 연결 끊김 → 30초 재시도. 실패하면 offline (개인 세션은 계속). */
function scheduleReconnect(roomId: string, code: string): void {
  const s = store()
  if (s.phase === 'idle') return
  if (s.connection !== 'reconnecting') {
    reconnectDeadline = Date.now() + 30_000
    s.patch({ connection: 'reconnecting' })
  }
  if (Date.now() > reconnectDeadline) {
    s.patch({ connection: 'offline' })
    return
  }
  if (reconnectTimer) window.clearTimeout(reconnectTimer)
  reconnectTimer = window.setTimeout(() => {
    void channel?.unsubscribe()
    subscribeChannel(roomId, code)
  }, 3000)
}

const REJOIN_KEY = 'upright-room-rejoin'

function saveRejoin(): void {
  const s = store()
  try {
    sessionStorage.setItem(
      REJOIN_KEY,
      JSON.stringify({ roomId: s.roomId, code: s.code, myId: s.myId, isHost: s.isHost }),
    )
  } catch { /* 저장 실패 무시 */ }
}

/** 새로고침 뒤 기존 참가자의 재접속 — join_room RPC 를 다시 부르지 않습니다. */
export async function rejoinFromStorage(code: string): Promise<boolean> {
  try {
    const raw = sessionStorage.getItem(REJOIN_KEY)
    if (!raw) return false
    const saved = JSON.parse(raw) as { roomId: string; code: string; myId: string; isHost: boolean }
    if (saved.code !== code.toUpperCase() || !saved.roomId) return false
    const userId = await ensureAnonymousUser()
    // 모두 떠난 버려진 방을 이 시점에 제한적으로 정리합니다.
    void sweepAbandonedRooms()
    if (!userId || userId !== saved.myId) return false
    giraffe = createGiraffeSync()
    store().patch({ phase: 'connecting', roomId: saved.roomId, code: saved.code, myId: userId, isHost: saved.isHost })
    subscribeChannel(saved.roomId, saved.code)
    return true
  } catch {
    return false
  }
}

/* -------------------------------- 공개 API ------------------------------- */

async function sweepAbandonedRooms(): Promise<void> {
  try {
    const supabase = await getSupabase()
    if (supabase) await supabase.rpc('cleanup_abandoned_rooms')
  } catch {
    /* 마이그레이션 전 — 무시 */
  }
}

export async function createRoom(input: {
  roomName: string
  subject: string
  goal: string
  durationSec: number
  /** 상시 방 — 전원 완주 후에도 닫히지 않고 대기실로 돌아옵니다 */
  isPersistent?: boolean
}): Promise<{ ok: boolean; code?: string; message?: string }> {
  const s = store()
  s.patch({ phase: 'connecting', errorMessage: null })

  const userId = await ensureAnonymousUser()
  // 모두 떠난 버려진 방을 이 시점에 제한적으로 정리합니다.
  void sweepAbandonedRooms()
  const supabase = await getSupabase()
  if (!userId || !supabase) {
    s.patch({ phase: 'error', errorMessage: '연결을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.' })
    return { ok: false, message: 'not-configured' }
  }

  const code = generateRoomCode()
  const { data, error } = await supabase.rpc('create_room', {
    p_code: code,
    p_nickname: useUserStore.getState().nickname,
    p_subject: input.subject || null,
    p_goal: input.goal || null,
    p_duration_seconds: input.durationSec,
    p_capacity: MAX_ROOM_MEMBERS,
    // 일반 방이면 인자를 아예 빼서, 마이그레이션 전 서버(6인자 create_room)
    // 에서도 그대로 동작하게 합니다.
    ...(input.isPersistent ? { p_is_persistent: true } : {}),
  })

  if (error || !data) {
    const message = error?.message ?? ''
    const friendly = message.includes('persistent room limit')
      ? `상시 방은 1인당 ${MAX_PERSISTENT_ROOMS}개까지 만들 수 있어요. 안 쓰는 상시 방을 닫고 다시 시도해 주세요.`
      : input.isPersistent && error?.code === 'PGRST202'
        ? '상시 방 기능이 아직 서버에 준비되지 않았어요. 일반 방으로 만들어 주세요.'
        : '방을 만들지 못했어요. 다시 시도해 주세요.'
    s.patch({ phase: 'error', errorMessage: friendly })
    return { ok: false, message: error?.message }
  }

  giraffe = createGiraffeSync()
  s.patch({
    phase: 'waiting',
    roomId: data as string,
    code,
    roomName: input.roomName,
    subject: input.subject,
    goal: input.goal,
    durationSec: input.durationSec,
    isPersistent: Boolean(input.isPersistent),
    myId: userId,
    isHost: true,
  })
  subscribeChannel(data as string, code)
  saveRejoin()
  return { ok: true, code }
}

export interface MyPersistentRoom {
  code: string
  subject: string | null
  status: string
}

/**
 * 내가 만든(방장) 상시 방 목록 — "코드로 입장" 옆 재입장 진입점용.
 * 마이그레이션 전(컬럼 없음)이나 오프라인이면 조용히 빈 목록을 돌려줍니다.
 */
export async function listMyPersistentRooms(): Promise<MyPersistentRoom[]> {
  try {
    const userId = await ensureAnonymousUser()
    const supabase = await getSupabase()
    if (!userId || !supabase) return []
    const { data, error } = await supabase
      .from('rooms')
      .select('code, subject, status')
      .eq('host_user_id', userId)
      .eq('is_persistent', true)
      .neq('status', 'closed')
      .order('created_at', { ascending: true })
      .limit(MAX_PERSISTENT_ROOMS)
    if (error || !data) return []
    return data.map((r) => ({
      code: r.code as string,
      subject: (r.subject as string | null) ?? null,
      status: r.status as string,
    }))
  } catch {
    return []
  }
}

export async function joinRoom(
  code: string,
): Promise<{ ok: boolean; message?: string }> {
  const s = store()
  s.patch({ phase: 'connecting', errorMessage: null })

  const userId = await ensureAnonymousUser()
  // 모두 떠난 버려진 방을 이 시점에 제한적으로 정리합니다.
  void sweepAbandonedRooms()
  const supabase = await getSupabase()
  if (!userId || !supabase) {
    s.patch({ phase: 'error', errorMessage: '연결을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.' })
    return { ok: false, message: 'not-configured' }
  }

  const { data, error } = await supabase.rpc('join_room', {
    p_code: code.toUpperCase(),
    p_nickname: useUserStore.getState().nickname,
  })

  if (error || !data) {
    const message = error?.message ?? ''
    // 'not open' = 새 서버(중간 합류 허용) · 'waiting' = 마이그레이션 전 서버.
    // 두 메시지를 모두 다뤄 SQL 실행 전에도 안내가 깨지지 않게 합니다.
    const friendly = message.includes('not found')
      ? '방을 찾지 못했어요. 코드를 다시 확인해 주세요.'
      : message.includes('full')
        ? `이 방은 정원(${MAX_ROOM_MEMBERS}명)이 찼어요.`
        : message.includes('not open')
          ? '이미 끝난 방이에요. 새 방을 만들어 보세요.'
          : message.includes('waiting')
            ? '이미 시작되었거나 종료된 방이에요.'
            : '입장하지 못했어요. 다시 시도해 주세요.'
    s.patch({ phase: 'error', errorMessage: friendly })
    return { ok: false, message: friendly }
  }

  giraffe = createGiraffeSync()
  s.patch({
    phase: 'waiting',
    roomId: data as string,
    code: code.toUpperCase(),
    myId: userId,
    isHost: false,
  })
  subscribeChannel(data as string, code.toUpperCase())
  saveRejoin()
  return { ok: true }
}

export async function setMyState(state: MemberState): Promise<void> {
  await channel?.track(myPresence(state))
  // 서버 검증(start_room_session)이 준비 상태를 읽을 수 있도록
  // 내 room_members.state 도 함께 기록합니다. (RLS: 내 행만 수정 가능)
  const s = store()
  const supabase = await getSupabase()
  if (!supabase || !s.roomId || !s.myId) return
  await supabase
    .from('room_members')
    .update({ state })
    .eq('room_id', s.roomId)
    .eq('user_id', s.myId)
}

/**
 * 방장만 시작 — 서버(start_room_session RPC)가 방장·waiting·2명·
 * 두 명 모두 ready 를 검증합니다. UI disabled 는 보조 수단일 뿐입니다.
 * 라이브 DB 에 마이그레이션이 아직 없으면(RPC 미존재) 기존 경로로 폴백합니다.
 */
export async function startRoomSession(): Promise<boolean> {
  const s = store()
  const supabase = await getSupabase()
  if (!supabase || !s.roomId || !s.isHost) return false

  const { error } = await supabase.rpc('start_room_session', {
    p_room_id: s.roomId,
  })
  if (error) {
    // PGRST202 = 함수 없음 (마이그레이션 전) → 레거시 직접 UPDATE 폴백
    if (error.code !== 'PGRST202') return false
    const { error: legacyError } = await supabase
      .from('rooms')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', s.roomId)
    if (legacyError) return false
  }
  await setMyState('focusing')
  return true
}

export async function reportRecovery(): Promise<void> {
  const s = store()
  if (s.phase !== 'running' || !s.roomId || !s.myId) return
  const eventId = crypto.randomUUID()
  const event: RoomEvent = {
    id: eventId,
    type: 'recovery_earned',
    participantId: s.myId,
    nickname: useUserStore.getState().nickname,
    timestamp: Date.now(),
  }
  handleEvent(event) // 내 화면에도 즉시 반영 (기린 싱크 감지 포함)
  await broadcast(event)
  await applyDamageRpc(s.roomId, eventId, 'recovery_earned', ROOM_DAMAGE.recovery)
}

export async function reportStretchComplete(): Promise<void> {
  const s = store()
  if (!s.roomId || !s.myId) return
  const eventId = crypto.randomUUID()
  await broadcast({
    id: eventId,
    type: 'stretch_completed',
    participantId: s.myId,
    nickname: useUserStore.getState().nickname,
    timestamp: Date.now(),
  })
  const supabase = await getSupabase()
  if (!supabase) return
  const { data } = await supabase.rpc('apply_room_shield', {
    p_room_id: s.roomId,
    p_event_id: eventId,
    p_amount: ROOM_SHIELD_PER_STRETCH,
  })
  if (typeof data === 'number') s.patch({ shield: data })
}

async function completeRoomIfDone(roomId: string): Promise<void> {
  try {
    const supabase = await getSupabase()
    if (supabase) await supabase.rpc('complete_room_if_done', { p_room_id: roomId })
  } catch {
    /* 마이그레이션 전 — 무시 */
  }
}

export async function reportSessionComplete(): Promise<void> {
  const s = store()
  if (!s.roomId || !s.myId) return
  const eventId = crypto.randomUUID()
  await broadcast({
    id: eventId,
    type: 'session_completed',
    participantId: s.myId,
    nickname: useUserStore.getState().nickname,
    timestamp: Date.now(),
  })
  await setMyState('completed')
  await applyDamageRpc(s.roomId, eventId, 'session_completed', ROOM_DAMAGE.sessionCompleted)
  // 두 참가자 모두 completed 면 서버가 방을 completed + ended_at 처리합니다.
  await completeRoomIfDone(s.roomId)
}

let lastReactionAt = 0

export async function sendReaction(
  reaction: ReactionKind,
  text?: string,
): Promise<void> {
  const s = store()
  if (!s.roomId || !s.myId) return
  // 5초에 1회 — 자유 채팅 방지
  if (Date.now() - lastReactionAt < 5000) return
  lastReactionAt = Date.now()
  const clean = text ? sanitizeReactionText(text) : undefined
  const event: RoomEvent = {
    id: crypto.randomUUID(),
    type: 'reaction_sent',
    participantId: s.myId,
    nickname: useUserStore.getState().nickname,
    reaction,
    reactionText: clean && clean.length >= 2 ? clean : undefined,
    timestamp: Date.now(),
  }
  handleEvent(event)
  await broadcast(event)
}

export async function leaveRoom(): Promise<void> {
  if (reconnectTimer) window.clearTimeout(reconnectTimer)
  if (pollTimer) window.clearInterval(pollTimer)
  pollTimer = null
  if (heartbeatTimer) window.clearInterval(heartbeatTimer)
  heartbeatTimer = null
  // 서버 쪽 멤버 행 정리 — 마지막 참가자면 방을 closed 처리하고,
  // 방장이 나가면 남은 참가자에게 방장을 넘깁니다. (leave_room RPC)
  // 마이그레이션 전(함수 없음)이나 오프라인이면 조용히 건너뜁니다.
  try {
    const s = store()
    const supabase = await getSupabase()
    if (supabase && s.roomId) {
      await supabase.rpc('leave_room', { p_room_id: s.roomId })
    }
  } catch {
    /* 정리는 최선 노력 — 실패해도 로컬 종료는 계속 */
  }
  try {
    sessionStorage.removeItem(REJOIN_KEY)
  } catch {
    /* 무시 */
  }
  await channel?.unsubscribe()
  channel = null
  giraffe = createGiraffeSync()
  store().reset()
}
