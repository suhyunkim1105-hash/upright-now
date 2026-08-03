import { create } from 'zustand'
import { ROOM_BOSS_MAX_HP, type ReactionKind } from './roomEvents'

/**
 * 친구 방 상태 — Supabase Presence/Broadcast/DB 를 반영하는 로컬 뷰.
 * 개인 자세 상태(bad 등)는 여기에 저장하지 않습니다. 성공 이벤트만 다룹니다.
 */
export type RoomPhase =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'running'
  | 'completed'
  | 'error'

export type RoomConnection = 'connected' | 'reconnecting' | 'offline'

export type MemberState = 'joining' | 'ready' | 'focusing' | 'resting' | 'away' | 'completed'

export interface RoomMember {
  /** 장착 아이템 (성공 이벤트와 함께 공유 허용 항목) */
  jacketId?: string
  backpackId?: string
  cameraReady: boolean
  calibrationReady: boolean
  modelReady: boolean
  userReady: boolean
  participantId: string
  nickname: string
  stage: number
  state: MemberState
  isHost: boolean
}

export interface ReactionFeedItem {
  id: string
  participantId: string
  nickname: string
  reaction: ReactionKind
  /** 커스텀 응원 문구 (있으면 기본 라벨 대신 표시) */
  reactionText?: string
  at: number
}

interface RoomStoreState {
  phase: RoomPhase
  connection: RoomConnection
  errorMessage: string | null
  roomId: string | null
  code: string | null
  roomName: string
  subject: string
  goal: string
  durationSec: number
  startedAt: number | null
  /** 상시 방 — 전원 완주 후 닫히지 않고 대기실로 돌아오는 방 */
  isPersistent: boolean
  myId: string | null
  isHost: boolean
  members: RoomMember[]
  bossHp: number
  bossMaxHp: number
  shield: number
  /** 친구 회복 공격 연출 트리거 (수신 시 +1) */
  friendAttackTick: number
  /** 내 카메라 권한 확인 여부 (presence 로만 공유) */
  myCameraReady: boolean
  /** 감지 사전 점검(모델 로드+1.5초 유효 랜드마크) 통과 */
  myModelReady: boolean
  /** 기린 싱크 연출 트리거 */
  syncFlashAt: number | null
  reactions: ReactionFeedItem[]
  /** 친구의 성공 이벤트 알림 문구 */
  lastFriendEvent: string | null

  patch: (partial: Partial<RoomStoreState>) => void
  addReaction: (item: ReactionFeedItem) => void
  reset: () => void
}

const initialState = {
  phase: 'idle' as RoomPhase,
  connection: 'connected' as RoomConnection,
  errorMessage: null,
  roomId: null,
  code: null,
  roomName: '',
  subject: '',
  goal: '',
  durationSec: 1500,
  startedAt: null,
  isPersistent: false,
  myId: null,
  isHost: false,
  members: [] as RoomMember[],
  bossHp: ROOM_BOSS_MAX_HP,
  bossMaxHp: ROOM_BOSS_MAX_HP,
  shield: 0,
  syncFlashAt: null,
  friendAttackTick: 0,
  myCameraReady: false,
  myModelReady: false,
  reactions: [] as ReactionFeedItem[],
  lastFriendEvent: null,
}

export const useRoomStore = create<RoomStoreState>((set) => ({
  ...initialState,
  patch: (partial) => set(partial),
  addReaction: (item) =>
    set((s) => ({ reactions: [item, ...s.reactions].slice(0, 4) })),
  reset: () => set({ ...initialState }),
}))

import { useSessionStore } from '@/features/sessions/sessionStore'

/**
 * "지금 친구 방 세션 중"의 단일 판정 — 네 조건을 모두 요구합니다.
 * 어느 하나라도 어긋나면(오래된 phase, sticky mode 등) 개인 세션으로 봅니다.
 */
export function isRoomSessionActive(): boolean {
  const room = useRoomStore.getState()
  const session = useSessionStore.getState()
  return (
    session.mode === 'room' &&
    room.phase === 'running' &&
    room.roomId !== null &&
    session.sessionId === `room-${room.code ?? ''}`
  )
}
