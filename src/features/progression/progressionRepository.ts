import { getSupabase } from '@/lib/supabase/client'
import type { RewardType } from '@/features/game/rewards'
import { useProgressionStore } from './progressionStore'
import type { StreakRewardEventType } from './streak'

/**
 * 서버 성장 원장 동기화.
 *
 * 로컬 보상은 UI 반응을 위해 먼저 적용하고, 서버 기록은 실패해도 앱을
 * 중단하지 않는 best-effort 방식으로 보냅니다. XP·포인트 숫자는 보내지
 * 않고 이벤트 종류만 보내 서버의 reward_rules가 지급량을 결정합니다.
 */
export async function syncProgressionReward(input: {
  eventId: string
  eventType: RewardType | StreakRewardEventType
  sessionId?: string
  plannedMinutes?: number
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = await getSupabase()
    if (!supabase) return

    const { data: session } = await supabase.auth.getSession()
    if (!session.session?.user) return

    const { data, error } = await supabase.rpc('apply_progression_reward', {
      p_event_id: input.eventId,
      p_event_type: input.eventType,
      p_source_session_id: input.sessionId ?? null,
      p_metadata: {
        client: 'web',
        schema_version: 1,
        ...input.metadata,
      },
      p_planned_minutes: input.plannedMinutes ?? null,
    })

    if (error) {
      // 서버 migration을 아직 적용하지 않은 개발 환경도 계속 사용할 수
      // 있어야 하므로, 동기화 실패는 로컬 보상 흐름을 막지 않습니다.
      console.warn('[progression] 서버 보상 동기화 실패', error.message)
      return
    }

    // 서버가 계산한 잔액을 최종 기준으로 사용합니다. 길이별 보상·일일 상한·중복
    // 이벤트가 적용된 뒤에도 로컬의 낙관적 숫자가 실제 잔액과 어긋나지 않습니다.
    const row = Array.isArray(data) ? data[0] : data
    const totalXp = Number((row as { total_xp?: unknown } | null)?.total_xp)
    const totalPoints = Number((row as { total_points?: unknown } | null)?.total_points)
    if (Number.isFinite(totalXp) && Number.isFinite(totalPoints)) {
      useProgressionStore.setState({ xp: Math.max(0, totalXp), points: Math.max(0, totalPoints) })
    }
  } catch (error) {
    console.warn('[progression] 서버 보상 동기화 예외', error)
  }
}

/**
 * 로그인된 사용자의 서버 잔액을 앱 시작 시 읽습니다.
 * 서버에 아직 잔액 행이 없거나 migration 전이면 로컬 상태를 그대로 둡니다.
 * 기존 로컬 기록을 잃지 않도록 양쪽 중 큰 값만 반영합니다.
 */
export async function hydrateProgressionFromServer(): Promise<void> {
  try {
    const supabase = await getSupabase()
    if (!supabase) return

    const { data: session } = await supabase.auth.getSession()
    if (!session.session?.user) return

    const { data, error } = await supabase
      .from('progression_balances')
      .select('xp, points')
      .eq('user_id', session.session.user.id)
      .maybeSingle()

    if (error || !data) return

    const serverXp = Number(data.xp) || 0
    const serverPoints = Number(data.points) || 0
    const local = useProgressionStore.getState()
    if (serverXp <= local.xp && serverPoints <= local.points) return

    useProgressionStore.setState({
      xp: Math.max(local.xp, serverXp),
      points: Math.max(local.points, serverPoints),
    })
  } catch {
    // 서버가 일시적으로 unavailable 해도 로컬 성장 기능은 계속 동작합니다.
  }
}
