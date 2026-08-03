import { describe, expect, it } from 'vitest'
import persistentRoomSql from '../../../supabase/migrations/20260731_persistent_room.sql?raw'
import roomServiceSrc from './roomService.ts?raw'
import roomNewSrc from '../../app/routes/RoomNew.tsx?raw'
import sessionRouteSrc from '../../app/routes/Session.tsx?raw'
import { ROOM_DAMAGE } from './roomEvents'
import {
  MAX_PERSISTENT_ROOMS,
  ROOM_BOSS_HP_PER_MEMBER,
  roomBossMaxHp,
} from '@/constants/rooms'

/**
 * 상시 방 — 전원 완주 후 completed 대신 waiting 으로 복귀해 재사용하는 방.
 * 일반 방의 기존 동작(완주 → completed, 2인 시작 = 2000)은 그대로여야 합니다.
 */

describe('상시 방 상수', () => {
  it('1인당 상시 방 3개', () => {
    expect(MAX_PERSISTENT_ROOMS).toBe(3)
  })

  it('서버 SQL 이 같은 값으로 개수를 제한하고 명확한 오류를 낸다', () => {
    expect(persistentRoomSql).toContain(
      `if v_persistent >= ${MAX_PERSISTENT_ROOMS} then`,
    )
    expect(persistentRoomSql).toContain(
      "raise exception 'persistent room limit reached'",
    )
  })
})

describe('서버 SQL — is_persistent 컬럼', () => {
  it('멱등으로 추가하고 기본값은 false (기존 방은 전부 일반 방)', () => {
    expect(persistentRoomSql).toContain(
      'add column if not exists is_persistent boolean not null default false',
    )
  })
})

describe('서버 SQL — 전원 완주 시 상시 방은 waiting 복귀', () => {
  it('150 보너스는 복귀·종료 직전에 일반·상시 공통으로 발동한다', () => {
    expect(persistentRoomSql).toContain(
      `damage_total = damage_total + ${ROOM_DAMAGE.bothCompleted}`,
    )
  })

  it('상시 방은 누적 피해를 리셋하고 waiting 으로 돌아간다', () => {
    expect(persistentRoomSql).toContain("set status = 'waiting'")
    expect(persistentRoomSql).toContain('damage_total = 0')
    expect(persistentRoomSql).toContain('boss_hp = boss_max_hp')
    expect(persistentRoomSql).toContain('started_at = null')
  })

  it('참가자 상태를 준비 전(joining)으로 초기화한다', () => {
    expect(persistentRoomSql).toContain("set state = 'joining'")
  })

  it('일반 방은 기존 그대로 completed 처리한다 (회귀)', () => {
    expect(persistentRoomSql).toContain("set status = 'completed'")
    expect(persistentRoomSql).toContain('v_total >= 2 and v_done = v_total')
  })
})

describe('서버 SQL — 최대 HP 유지(ratchet)와 2인 회귀', () => {
  it('상시 방 재시작은 이전 라운드의 최대 HP 를 내리지 않는다', () => {
    expect(persistentRoomSql).toContain(
      `v_boss := greatest(v_room.boss_max_hp, ${ROOM_BOSS_HP_PER_MEMBER} * v_members)`,
    )
  })

  it('일반 방 시작은 기존 그대로 1000 × 인원 (2명 = 2000)', () => {
    expect(persistentRoomSql).toContain(
      `v_boss := ${ROOM_BOSS_HP_PER_MEMBER} * v_members`,
    )
    expect(roomBossMaxHp(2)).toBe(2000)
  })
})

describe('서버 SQL — 방 수명 정리', () => {
  it('상시 방은 모두 나가도 닫지 않고 waiting 으로 되돌린다', () => {
    expect(persistentRoomSql).toContain('if v_room.is_persistent then')
    // 일반 방의 "마지막 참가자 → closed" 는 그대로 남아 있어야 합니다.
    expect(persistentRoomSql).toContain("set status = 'closed', ended_at = now()")
  })

  it('45초 무응답 정리는 일반 방만 대상이다', () => {
    expect(persistentRoomSql).toContain('not r.is_persistent')
    expect(persistentRoomSql).toContain("interval '45 seconds'")
  })

  it('상시 방은 7일 무활동일 때만 정리 대상에 든다', () => {
    expect(persistentRoomSql).toContain("interval '7 days'")
  })
})

describe('서버 SQL — 멱등', () => {
  it('여러 번 실행해도 안전한 구문만 쓴다', () => {
    expect(persistentRoomSql).toContain('add column if not exists')
    expect(persistentRoomSql).toContain('create or replace function')
  })
})

describe('클라이언트 — 생성·재입장·정리', () => {
  it('일반 방 생성은 인자를 빼서 마이그레이션 전 서버와도 호환된다', () => {
    expect(roomServiceSrc).toContain(
      'input.isPersistent ? { p_is_persistent: true } : {}',
    )
  })

  it('개수 초과 오류를 사용자 문구로 안내한다', () => {
    expect(roomServiceSrc).toContain("message.includes('persistent room limit')")
  })

  it('내 상시 방 목록 진입점이 있다', () => {
    expect(roomServiceSrc).toContain('listMyPersistentRooms')
    expect(roomNewSrc).toContain('listMyPersistentRooms')
    expect(roomNewSrc).toContain('상시 방으로 만들기')
  })

  it('상시 방 세션이 끝나도 방을 나가지 않는다 (재사용 유지)', () => {
    expect(sessionRouteSrc).toContain('if (!room.isPersistent) void leaveRoom()')
  })
})
