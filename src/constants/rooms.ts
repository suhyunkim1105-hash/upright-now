/**
 * 친구 방 인원 상수 — 이 값이 단일 출처입니다.
 * 서버(supabase/migrations/20260729_room_multi_member.sql)의
 * rooms.capacity 제약(2~10)과 같은 값을 유지해야 합니다.
 */

/** 한 방에 들어갈 수 있는 최대 인원 */
export const MAX_ROOM_MEMBERS = 10

/** 세션을 시작하려면 최소 몇 명이 필요한지 */
export const MIN_ROOM_MEMBERS = 2

/** 참가자 1명당 공동 괴물 체력 — 시작 시점 인원 × 이 값 */
export const ROOM_BOSS_HP_PER_MEMBER = 1000

/**
 * 한 사람이 만들 수 있는 상시 방 개수.
 * 서버(supabase/migrations/20260731_persistent_room.sql)의 제한(3)과
 * 같은 값을 유지해야 합니다.
 */
export const MAX_PERSISTENT_ROOMS = 3

/**
 * 시작 시점 인원으로 확정되는 공동 괴물 체력.
 * 서버 start_room_session 이 최종 기준이고, 이 함수는 화면 예측·테스트용입니다.
 * 2명이면 2000 으로 기존과 같습니다.
 */
export function roomBossMaxHp(memberCount: number): number {
  const clamped = Math.min(
    MAX_ROOM_MEMBERS,
    Math.max(MIN_ROOM_MEMBERS, Math.floor(memberCount)),
  )
  return clamped * ROOM_BOSS_HP_PER_MEMBER
}
