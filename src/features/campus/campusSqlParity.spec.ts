import { describe, expect, it } from 'vitest'
import manifest from './campusGridSeedManifest.json'
import {
  CAMPUS_GRID_CELLS,
  CAMPUS_GRID_CELL_COUNT,
  CAMPUS_GRID_SEED,
} from './campusGridOverlay'
import { createSeasonMap } from './campusMap'
import campusSql from '../../../supabase/migrations/20260727_campus_realtime_v2.sql?raw'
import finalSql from '../../../supabase/migrations/20260727_campus_final_grid_realtime.sql?raw'
import roomSql from '../../../supabase/migrations/20260727_room_presence_cleanup.sql?raw'
import verificationSql from '../../../supabase/migrations/20260730_campus_school_verification.sql?raw'
import quarterlySql from '../../../supabase/migrations/20260805_campus_quarterly_seasons.sql?raw'
import repoSrc from './supabaseRepository.ts?raw'
import roomServiceSrc from '../rooms/roomService.ts?raw'

/**
 * 단일 기준 검증 — UI overlay · mock createSeasonMap · SQL seed 가
 * 정확히 같은 96(12×8) manifest 를 쓰는지, 최종 migration(v3)이
 * 권위 응답·안전 디렉터리·publication 을 포함하는지 확인합니다.
 */

const ZONES = new Set([
  'library', 'plaza', 'lecture', 'lawn', 'cafe', 'dorm', 'field', 'pond',
])

describe('campus RC2 — 96(12×8) 단일 seed manifest', () => {
  it('manifest 는 96개·중복 없는 x/y·유효한 zone·고유한 이름이다', () => {
    expect(manifest).toHaveLength(96)
    const keys = new Set(manifest.map((m) => `${m.x},${m.y}`))
    expect(keys.size).toBe(96)
    for (const m of manifest) {
      expect(m.x).toBeGreaterThanOrEqual(0)
      expect(m.x).toBeLessThanOrEqual(11)
      expect(m.y).toBeGreaterThanOrEqual(0)
      expect(m.y).toBeLessThanOrEqual(7)
      expect(ZONES.has(m.zone)).toBe(true)
      expect(m.name.length).toBeGreaterThanOrEqual(2)
    }
    expect(new Set(manifest.map((m) => m.name)).size).toBe(96)
  })

  it('UI overlay 셀도 96개이고 manifest 좌표와 1:1 이다', () => {
    expect(CAMPUS_GRID_CELL_COUNT).toBe(96)
    expect(CAMPUS_GRID_CELLS).toHaveLength(96)
    const cellKeys = new Set(CAMPUS_GRID_CELLS.map((c) => `${c.x},${c.y}`))
    expect(cellKeys.size).toBe(96)
    for (const m of manifest) expect(cellKeys.has(`${m.x},${m.y}`)).toBe(true)
    for (const c of CAMPUS_GRID_CELLS) {
      expect(c.points.split(' ')).toHaveLength(4)
    }
  })

  it('mock createSeasonMap 은 manifest 와 같은 zone·name 의 96타일을 만든다', () => {
    const tiles = createSeasonMap('season-1', 0)
    expect(tiles).toHaveLength(96)
    const byXY = new Map(tiles.map((t) => [`${t.x},${t.y}`, t]))
    for (const m of manifest) {
      const tile = byXY.get(`${m.x},${m.y}`)
      expect(tile?.zone).toBe(m.zone)
      expect(tile?.name).toBe(m.name)
      expect(tile?.id).toBe(`season-1:${m.x}-${m.y}`)
    }
  })

  it('최종 SQL seed 에 96행이 전부 같은 값으로 들어 있다', () => {
    for (const m of manifest) {
      expect(finalSql).toContain(`(${m.x}, ${m.y}, '${m.zone}', '${m.name.replace(/'/g, "''")}')`)
    }
    expect(finalSql).toContain(`v_season || ':' || r.x || '-' || r.y`)
    // 기존 데이터 보존 — 있는 칸은 건드리지 않는다
    expect(finalSql).toContain('on conflict (id) do nothing')
    // 실행 즉시 활성 시즌 96 보장
    expect(finalSql).toContain('select public.ensure_active_campus_season();')
  })

  it('CAMPUS_GRID_SEED(코드) 와 manifest(JSON) 는 같은 배열이다', () => {
    expect(CAMPUS_GRID_SEED).toEqual(manifest)
  })
})

describe('campus school verification migration', () => {
  it('creates private matching-school authorization for campus writes', () => {
    expect(verificationSql).toContain('create table if not exists public.campus_school_domains')
    expect(verificationSql).toContain('create table if not exists public.campus_verifications')
    expect(verificationSql).toContain('create or replace function public.campus_verify_school')
    expect(verificationSql).toContain("raise exception 'school_verification_required'")
    expect(verificationSql).toContain('revoke insert, update, delete on public.campus_verifications')
  })
})

describe('campus quarterly season migration', () => {
  it('uses UTC calendar quarters and preserves the prior grid', () => {
    expect(quarterlySql).toContain("date_trunc('quarter'")
    expect(quarterlySql).toContain("interval '3 months'")
    expect(quarterlySql).toContain("format('season-%s-q%s'")
    expect(quarterlySql).toContain('where t.season_id = v_source')
    expect(quarterlySql).toContain('on conflict (id) do nothing')
  })
})

describe('campus RC2 — apply_campus_contribution v3 권위 응답', () => {
  it('권위값·영토 상태·서버 시각을 함께 돌려준다', () => {
    expect(finalSql).toContain("'authoritativeMyContribution', v_my_total")
    expect(finalSql).toContain("'updatedTerritory', to_jsonb(v_territory)")
    expect(finalSql).toContain("'serverTime', now()")
    expect(finalSql).toContain("'acceptedPoints', v_points")
  })

  it('duplicate_event 와 duplicate_session 을 constraint 로 구분한다', () => {
    expect(finalSql).toContain('get stacked diagnostics v_constraint = constraint_name')
    expect(finalSql).toContain("v_constraint = 'campus_contributions_session_once'")
    expect(finalSql).toContain("'duplicate_session'")
    expect(finalSql).toContain("'duplicate_event'")
  })

  it('점수·상한·잠금 정책이 v2.3 과 동일하게 유지된다', () => {
    expect(finalSql).toContain("when 'session_completed' then 100")
    expect(finalSql).toContain("when 'friend_session_completed' then 50")
    expect(finalSql).toContain("when 'posture_recovered' then 20")
    expect(finalSql).toContain("when 'stretch_completed' then 20")
    expect(finalSql).toContain('> 600')
    expect(finalSql).toContain("interval '20 seconds'")
    expect(finalSql).toContain("hashtext(auth.uid()::text || ':' || v_season)")
    expect(finalSql).toContain('session_required')
    expect(finalSql).toContain('no_membership')
  })

  it('클라이언트는 서버 권위값을 그대로 사용한다', () => {
    expect(repoSrc).toContain('authoritativeMyContribution')
    expect(repoSrc).toContain('updatedTerritory')
  })
})

describe('campus RC2 — 안전한 학교 디렉터리', () => {
  it('디렉터리 실테이블에 created_by 가 없다', () => {
    const start = finalSql.indexOf(
      'create table if not exists public.campus_school_directory_entries',
    )
    const table = finalSql.slice(start, finalSql.indexOf(';', start))
    expect(table).toContain('display_name')
    expect(table).toContain('is_custom')
    expect(table).not.toContain('created_by')
  })

  it('클라이언트 직접 쓰기가 금지되고 trigger 만 동기화한다', () => {
    expect(finalSql).toContain(
      'revoke insert, update, delete on public.campus_school_directory_entries',
    )
    expect(finalSql).toContain('create trigger campus_schools_directory_sync')
    expect(finalSql).toContain('after insert or update or delete on public.campus_schools')
  })

  it('기존 학교 backfill 과 publication 등록이 있다', () => {
    expect(finalSql).toContain('from public.campus_schools')
    expect(finalSql).toContain(
      'add table public.campus_school_directory_entries',
    )
  })

  it('membership 복원 RPC 가 자기 것만 돌려준다', () => {
    expect(finalSql).toContain('create or replace function public.campus_my_membership')
    expect(finalSql).toContain('m.user_id = auth.uid()')
  })

  it('클라이언트 구독 테이블이 publication 과 같다 (3개)', () => {
    expect(repoSrc).toContain(`table: 'campus_territories'`)
    expect(repoSrc).toContain(`table: 'campus_territory_events'`)
    expect(repoSrc).toContain(`table: 'campus_school_directory_entries'`)
  })
})

describe('campus RC2 — Realtime 인증·재연결·mock fallback 금지', () => {
  it('구독 전에 익명 로그인과 realtime.setAuth 를 수행한다', () => {
    const connect = repoSrc.slice(
      repoSrc.indexOf('private async connect'),
      repoSrc.indexOf('private openChannel'),
    )
    expect(connect).toContain('ensureAnonymousUser')
    expect(connect).toContain('realtime.setAuth')
  })

  it('SUBSCRIBED 확인 후에만 connected 를 알리고, 오류는 backoff 재구독한다', () => {
    expect(repoSrc).toContain("if (status === 'SUBSCRIBED')")
    expect(repoSrc).toContain('scheduleReconnect')
    expect(repoSrc).toContain('RECONNECT_MAX_MS')
  })

  it('live 모드 캠퍼스 스토어에 mock fallback 경로가 없다', async () => {
    const storeSrc = (await import('./campusStore.ts?raw')).default
    const liveBlock = storeSrc.slice(
      storeSrc.indexOf("if (repo.kind === 'supabase')"),
      storeSrc.indexOf('// mock 경로'),
    )
    expect(liveBlock).not.toContain('MockCampusRepository')
    expect(liveBlock).toContain("status: 'error'")
  })
})

/* ------------- 기존 migration(불변) 에 대한 검증 — 그대로 유지 ------------- */

describe('campus v2.2/2.3 — 원장 보호·서버 결정 (기존 SQL 불변 확인)', () => {
  it('기여 원장은 직접 SELECT 불가', () => {
    expect(campusSql).toContain(
      'revoke select on public.campus_contributions from authenticated',
    )
    expect(campusSql).not.toContain('create policy campus_contributions_select')
  })

  it('apply 서명에 school/member/points 클라이언트 인자가 없다', () => {
    const signature = finalSql.slice(
      finalSql.indexOf('create or replace function public.apply_campus_contribution'),
      finalSql.indexOf('$fn$', finalSql.indexOf('apply_campus_contribution')),
    )
    expect(signature).not.toContain('p_school_id')
    expect(signature).not.toContain('p_member_hash')
    expect(signature).not.toContain('p_points')
  })

  it('클라이언트도 school/member/points 인자를 보내지 않는다', () => {
    const call = repoSrc.slice(
      repoSrc.indexOf("rpc('apply_campus_contribution'"),
      repoSrc.indexOf('})', repoSrc.indexOf("rpc('apply_campus_contribution'")),
    )
    expect(call).not.toContain('p_school_id')
    expect(call).not.toContain('p_member_hash')
    expect(call).not.toContain('p_points')
  })

  it('학교 변경 7일 쿨다운·시즌 1회 제한이 서버에 있다', () => {
    expect(campusSql).toContain("'change_cooldown'")
    expect(campusSql).toContain('next_allowed_at')
    expect(campusSql).toContain("interval '7 days'")
    expect(campusSql).toContain('changes_in_season >= 1')
  })

  it('스트레칭 중복은 서버 unique index 로 차단된다', () => {
    const start = campusSql.indexOf(
      'create unique index if not exists campus_contributions_session_once',
    )
    const idx = campusSql.slice(start, campusSql.indexOf(';', start))
    expect(idx).toContain('session_id is not null')
    expect(idx).toContain("'stretch_completed'")
  })

  it('커스텀 학교 existing 합류·소유권 충돌이 서버에 있다', () => {
    for (const r of ['created', 'updated', 'existing', 'name_conflict', 'ownership_conflict', 'invalid']) {
      expect(campusSql).toContain("'" + r + "'")
    }
    expect(campusSql).toContain('created_by is distinct from auth.uid()')
  })
})

describe('room presence v2/v2.1 — 불변 확인', () => {
  it('멤버십 가드·자기 삭제 금지·행 잠금', () => {
    expect(roomSql).toContain('create or replace function public.is_room_member')
    expect(roomSql).toContain("raise exception 'not a room member'")
    expect(roomSql).toContain('user_id <> auth.uid()')
    expect(roomSql).toContain('for update')
  })

  it('버려진 방 정리 조건이 안전하다', () => {
    expect(roomSql).toContain("r.status in ('waiting', 'running')")
    expect(roomSql).toContain('r.ended_at is null')
    expect(roomSql).toContain("m.last_seen_at >= now() - interval '45 seconds'")
    expect(roomSql).toContain('limit 10')
    expect(roomServiceSrc).toContain("rpc('cleanup_abandoned_rooms')")
  })
})
