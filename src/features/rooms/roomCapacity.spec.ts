import { describe, expect, it } from 'vitest'
import roomMultiMemberSql from '../../../supabase/migrations/20260729_room_multi_member.sql?raw'
import roomServiceSrc from './roomService.ts?raw'
import {
  MAX_ROOM_MEMBERS,
  MIN_ROOM_MEMBERS,
  ROOM_BOSS_HP_PER_MEMBER,
  roomBossMaxHp,
} from '@/constants/rooms'
import { createGiraffeSync, registerRecovery } from './giraffeSync'

/**
 * 친구 방 인원 확장(2인 → 최대 10인).
 *
 * 서버가 최종 기준이므로 SQL 과 클라이언트 상수가 어긋나지 않는지 함께 봅니다.
 * 2명일 때 기존과 완전히 같은 값이 나오는지(회귀 방지)를 특히 고정합니다.
 */

describe('인원 상수', () => {
  it('최소 2명, 최대 10명', () => {
    expect(MIN_ROOM_MEMBERS).toBe(2)
    expect(MAX_ROOM_MEMBERS).toBe(10)
  })

  it('참가자 1명당 공동 괴물 체력 1000', () => {
    expect(ROOM_BOSS_HP_PER_MEMBER).toBe(1000)
  })
})

describe('공동 괴물 체력 — 시작 시점 인원 비례', () => {
  it('2명이면 2000 (기존 동작과 동일)', () => {
    expect(roomBossMaxHp(2)).toBe(2000)
  })

  it('인원 수 × 1000', () => {
    expect(roomBossMaxHp(3)).toBe(3000)
    expect(roomBossMaxHp(5)).toBe(5000)
    expect(roomBossMaxHp(10)).toBe(10000)
  })

  it('정원 밖 값은 2~10 으로 잘린다', () => {
    expect(roomBossMaxHp(1)).toBe(2000)
    expect(roomBossMaxHp(0)).toBe(2000)
    expect(roomBossMaxHp(99)).toBe(10000)
  })
})

describe('기린 싱크 — 3명 이상에서도 성립', () => {
  it('서로 다른 두 참가자면 세 명 방에서도 싱크가 난다', () => {
    let state = createGiraffeSync()
    // p1 회복 → 아직 싱크 아님
    const a = registerRecovery(state, {
      eventId: 'm-a',
      participantId: 'p1',
      timestamp: 0,
    })
    state = a.state
    expect(a.sync).toBe(false)

    // p3 회복 → 서로 다른 참가자이므로 싱크
    const b = registerRecovery(state, {
      eventId: 'm-b',
      participantId: 'p3',
      timestamp: 5000,
    })
    expect(b.sync).toBe(true)
    expect(b.pairIds).toEqual(['m-a', 'm-b'])
  })

  it('세 번째 참가자의 회복도 이미 쓰인 이벤트를 재사용하지 않는다', () => {
    let state = createGiraffeSync()
    state = registerRecovery(state, {
      eventId: 'm-1',
      participantId: 'p1',
      timestamp: 0,
    }).state
    const paired = registerRecovery(state, {
      eventId: 'm-2',
      participantId: 'p2',
      timestamp: 1000,
    })
    state = paired.state
    expect(paired.sync).toBe(true)

    // p3 가 뒤이어 회복해도 이미 소비된 m-1·m-2 로 다시 싱크가 나면 안 됩니다.
    const third = registerRecovery(state, {
      eventId: 'm-3',
      participantId: 'p3',
      timestamp: 2000,
    })
    expect(third.sync).toBe(false)
  })
})

describe('서버 SQL — 정원과 인원 비례 체력', () => {
  it('capacity 컬럼이 2~10 으로 제한된다', () => {
    expect(roomMultiMemberSql).toContain('add column if not exists capacity')
    expect(roomMultiMemberSql).toContain('check (capacity between 2 and 10)')
  })

  it('기존 방은 capacity 2 로 채워 동작이 바뀌지 않는다', () => {
    expect(roomMultiMemberSql).toContain(
      'update public.rooms set capacity = 2 where capacity is null',
    )
  })

  it('신규 방 기본 정원은 10', () => {
    expect(roomMultiMemberSql).toContain('alter column capacity set default 10')
  })

  it('입장 정원 검사가 고정 2 가 아니라 방의 capacity 를 쓴다', () => {
    expect(roomMultiMemberSql).toContain('v_count >= coalesce(v_room.capacity, 2)')
    expect(roomMultiMemberSql).not.toContain('if v_count >= 2 then')
  })

  it('시작 조건이 2명 이상 · 전원 ready 로 일반화됐다', () => {
    expect(roomMultiMemberSql).toContain('if v_members < 2 then')
    expect(roomMultiMemberSql).toContain('if v_ready <> v_members then')
    expect(roomMultiMemberSql).not.toContain('if v_members <> 2 then')
  })

  it('시작 시점 인원으로 공동 괴물 체력을 확정한다 (1000 × 인원)', () => {
    expect(roomMultiMemberSql).toContain('v_boss := 1000 * v_members')
    expect(roomMultiMemberSql).toContain('boss_max_hp = v_boss')
    expect(roomMultiMemberSql).toContain('boss_hp = v_boss')
  })

  it('완주 판정이 전원 완주로 일반화됐다', () => {
    expect(roomMultiMemberSql).toContain('v_total >= 2 and v_done = v_total')
    expect(roomMultiMemberSql).not.toContain('v_total = 2 and v_done = 2')
  })

  it('멱등 — 여러 번 실행해도 안전한 구문만 쓴다', () => {
    expect(roomMultiMemberSql).toContain('add column if not exists')
    expect(roomMultiMemberSql).toContain('create or replace function')
  })
})

describe('클라이언트 — 서버와 같은 정원을 보낸다', () => {
  it('방 만들기에서 capacity 를 상수로 전달한다', () => {
    expect(roomServiceSrc).toContain('p_capacity: MAX_ROOM_MEMBERS')
  })

  it('정원 초과 안내에 2인 전제 문구가 남아 있지 않다', () => {
    expect(roomServiceSrc).not.toContain('이미 두 명이 참여하고 있어요')
  })
})
