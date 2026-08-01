import { beforeEach, describe, expect, it } from 'vitest'
import roomMidJoinSql from '../../../supabase/migrations/20260731_room_mid_join.sql?raw'
import roomServiceSrc from './roomService.ts?raw'
import roomRouteSrc from '../../app/routes/Room.tsx?raw'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { roomBossMaxHp } from '@/constants/rooms'

/**
 * 친구 방 중간 합류 — running 방에도 입장을 허용하되,
 * 완료·만료 거부와 정원 검사는 그대로 유지합니다.
 * 합류자는 방의 남은 시간을 그대로 따르고(개인 타이머 새로 안 만듦),
 * 입장 시 recalc_room_boss 가 최대 HP 를 인원 기준으로 상향합니다.
 */

describe('서버 SQL — running 입장 허용, 종료 방 거부', () => {
  it('waiting·running 만 허용하고 그 외(완료·만료)는 거부한다', () => {
    expect(roomMidJoinSql).toContain(
      "if v_room.status not in ('waiting', 'running') then",
    )
    expect(roomMidJoinSql).toContain("raise exception 'room is not open'")
    // waiting 전용 검사가 되살아나면 중간 합류가 다시 막힙니다.
    expect(roomMidJoinSql).not.toContain("v_room.status <> 'waiting'")
  })

  it('정원(capacity) 검사는 기존 그대로다', () => {
    expect(roomMidJoinSql).toContain('v_count >= coalesce(v_room.capacity, 2)')
    expect(roomMidJoinSql).toContain("raise exception 'room is full'")
  })

  it('running 합류 시 recalc_room_boss 로 최대 HP 를 상향한다', () => {
    expect(roomMidJoinSql).toContain("if v_room.status = 'running' then")
    expect(roomMidJoinSql).toContain('perform public.recalc_room_boss(v_room.id)')
  })

  it('join_room 만 바꾼다 — 시작·퇴장·완주 로직은 손대지 않는다', () => {
    expect(roomMidJoinSql).not.toContain('function public.start_room_session')
    expect(roomMidJoinSql).not.toContain('function public.leave_room')
    expect(roomMidJoinSql).not.toContain('function public.complete_room_if_done')
  })

  it('멱등 — 여러 번 실행해도 안전한 구문만 쓴다', () => {
    expect(roomMidJoinSql).toContain('create or replace function')
  })
})

describe('2인 회귀 — 기존 방 동작 불변', () => {
  it('2명 방의 공동 괴물 체력은 여전히 2000', () => {
    expect(roomBossMaxHp(2)).toBe(2000)
  })
})

describe('클라이언트 — 서버 신·구 메시지 모두 안내한다', () => {
  it('새 서버(not open)와 마이그레이션 전 서버(waiting) 둘 다 매핑한다', () => {
    expect(roomServiceSrc).toContain("message.includes('not open')")
    expect(roomServiceSrc).toContain("message.includes('waiting')")
  })
})

describe('클라이언트 — 합류자는 방의 남은 시간을 따른다', () => {
  it('Room 화면이 중간 합류 시 남은 시간으로 계획을 덮어쓴다', () => {
    expect(roomRouteSrc).toContain('plannedMsOverride')
  })

  it('자세 기준 없는 합류자는 자동 시작하지 않고 기존 등록 안내를 거친다', () => {
    expect(roomRouteSrc).toContain('!validActiveProfile')
  })
})

describe('sessionStore — plannedMsOverride', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it('남은 시간이 프리셋보다 짧으면 그 값으로 줄인다', () => {
    useSessionStore.getState().configure({
      lengthId: '25',
      plannedMsOverride: 600_000,
    })
    expect(useSessionStore.getState().plannedMs).toBe(600_000)
  })

  it('프리셋보다 늘릴 수는 없다', () => {
    useSessionStore.getState().configure({
      lengthId: '25',
      plannedMsOverride: 99_999_999,
    })
    expect(useSessionStore.getState().plannedMs).toBe(1_500_000)
  })

  it('방이 거의 끝났어도 최소 1분은 보장한다', () => {
    useSessionStore.getState().configure({
      lengthId: '25',
      plannedMsOverride: 5_000,
    })
    expect(useSessionStore.getState().plannedMs).toBe(60_000)
  })

  it('override 가 없으면 기존 프리셋 그대로다 (회귀)', () => {
    useSessionStore.getState().configure({ lengthId: '25' })
    expect(useSessionStore.getState().plannedMs).toBe(1_500_000)
  })
})
