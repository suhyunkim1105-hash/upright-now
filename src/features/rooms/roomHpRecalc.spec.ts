import { describe, expect, it } from 'vitest'
import roomHpRecalcSql from '../../../supabase/migrations/20260731_room_hp_recalc.sql?raw'
import { ROOM_DAMAGE } from './roomEvents'
import { DAMAGE } from '@/constants/game'
import { ROOM_BOSS_HP_PER_MEMBER, roomBossMaxHp } from '@/constants/rooms'

/**
 * 공동 괴물 HP 저장 구조 재설계 —
 * "남은 HP" → "최대 HP(boss_max_hp) + 누적 피해(damage_total)".
 *
 * 서버가 최종 기준이므로 SQL 이 확정 설계(ratchet 상향·퇴장 시 유지 A안·
 * 2인 = 2000 회귀·시작 시 damage_total 리셋·전원 완주 보너스 150)에서
 * 벗어나지 않는지 문자열로 고정합니다.
 */

describe('bothCompleted 보너스 상수', () => {
  it('ROOM_DAMAGE.bothCompleted 는 150', () => {
    expect(ROOM_DAMAGE.bothCompleted).toBe(150)
  })

  it('게임 상수 DAMAGE.bothCompleted 와 같은 값', () => {
    expect(ROOM_DAMAGE.bothCompleted).toBe(DAMAGE.bothCompleted)
  })

  it('서버 SQL 이 같은 값으로 전원 완주 보너스를 발동한다', () => {
    expect(roomHpRecalcSql).toContain(
      `damage_total = damage_total + ${ROOM_DAMAGE.bothCompleted}`,
    )
    expect(roomHpRecalcSql).toContain(
      `boss_hp = greatest(0, boss_max_hp - (damage_total + ${ROOM_DAMAGE.bothCompleted}))`,
    )
  })
})

describe('서버 SQL — damage_total 컬럼과 백필', () => {
  it('컬럼을 멱등으로 추가하고 0 이상으로 제한한다', () => {
    expect(roomHpRecalcSql).toContain(
      'alter table public.rooms add column if not exists damage_total',
    )
    expect(roomHpRecalcSql).toContain('check (damage_total >= 0)')
  })

  it('백필이 항등 변환이라 기존 방의 남은 HP 가 바뀌지 않는다', () => {
    expect(roomHpRecalcSql).toContain(
      'set damage_total = greatest(0, boss_max_hp - boss_hp)',
    )
  })
})

describe('서버 SQL — 피해는 누적, 남은 HP 는 파생값', () => {
  it('apply_room_damage 가 damage_total 에 누적한다', () => {
    expect(roomHpRecalcSql).toContain('damage_total = damage_total + p_damage')
  })

  it('boss_hp 는 항상 greatest(0, max - 누적 피해) 로 계산한다', () => {
    expect(roomHpRecalcSql).toContain(
      'boss_hp = greatest(0, boss_max_hp - (damage_total + p_damage))',
    )
  })

  it('검증(이벤트 타입·피해 상한)과 중복 차단은 기존 그대로다', () => {
    expect(roomHpRecalcSql).toContain(
      "('recovery_earned', 'session_completed', 'giraffe_sync')",
    )
    expect(roomHpRecalcSql).toContain('p_damage < 0 or p_damage > 250')
    expect(roomHpRecalcSql).toContain('room_events_processed')
  })
})

describe('서버 SQL — recalc_room_boss (ratchet 상향)', () => {
  it('최대 HP 는 greatest 로 올리기만 한다 — 퇴장해도 내려가지 않는다 (A안)', () => {
    expect(roomHpRecalcSql).toContain(
      `v_new_max := greatest(v_room.boss_max_hp, ${ROOM_BOSS_HP_PER_MEMBER} * v_members)`,
    )
  })

  it('상향 후에도 누적 피해를 유지한 채 남은 HP 를 재계산한다', () => {
    expect(roomHpRecalcSql).toContain(
      'boss_hp = greatest(0, v_new_max - damage_total)',
    )
  })

  it('running 상태의 방만 대상으로 한다', () => {
    expect(roomHpRecalcSql).toContain("if v_room.status <> 'running' then")
  })

  it('leave_room 은 이 마이그레이션에서 건드리지 않는다', () => {
    expect(roomHpRecalcSql).not.toContain('function public.leave_room')
  })
})

describe('서버 SQL — 시작 시 확정과 2인 회귀', () => {
  it('시작 시점 인원 × 1000 으로 확정한다 (2명 = 2000, 기존과 동일)', () => {
    expect(roomHpRecalcSql).toContain(
      `v_boss := ${ROOM_BOSS_HP_PER_MEMBER} * v_members`,
    )
    expect(roomBossMaxHp(2)).toBe(2000)
  })

  it('시작할 때 누적 피해를 0 으로 리셋한다', () => {
    expect(roomHpRecalcSql).toContain('damage_total = 0')
  })
})

describe('서버 SQL — 보호와 멱등', () => {
  it('직접 UPDATE 차단 트리거가 damage_total 도 막는다', () => {
    expect(roomHpRecalcSql).toContain(
      'new.damage_total is distinct from old.damage_total',
    )
  })

  it('멱등 — 여러 번 실행해도 안전한 구문만 쓴다', () => {
    expect(roomHpRecalcSql).toContain('add column if not exists')
    expect(roomHpRecalcSql).toContain('create or replace function')
  })
})
