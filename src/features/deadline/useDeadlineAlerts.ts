import { useEffect, useRef } from 'react'
import { nextAlert, shouldDelayForRecovery } from './deadlineLogic'
import { useDeadlineStore } from './deadlineStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useCharacterVisualStore } from '@/features/posture-engine/characterVisualStore'
import { useUserStore } from '@/features/onboarding/userStore'
import { useSessionStore } from '@/features/sessions/sessionStore'

/**
 * 마감 알림 티커 — 세션 화면에서 1초 간격으로 단계를 확인합니다.
 * PIP·미니 위젯은 같은 deadlineStore 를 구독하므로 자동 동기화됩니다.
 *
 * - 회복 기회·회복 연출 중에는 최대 5초 지연 후 표시합니다.
 * - 알림이 자세 측정·세션 타이머·친구 방을 중단시키지 않습니다.
 * - 도서관 모드: 무음. 내 공간: 사용자가 소리를 켠 경우에만 짧은 효과음.
 */
function chirp(): void {
  try {
    const { profileId, soundEnabled } = useUserStore.getState()
    if (profileId !== 'home' || !soundEnabled) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
    osc.onended = () => void ctx.close()
  } catch {
    // 오디오 미지원 환경 무시
  }
}

export function useDeadlineAlerts(active: boolean): void {
  const pendingSinceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return

    const timer = window.setInterval(() => {
      const deadline = useDeadlineStore.getState()
      const now = Date.now()

      // 다른 세션의 마감이 새 세션으로 새어 들어오지 않게 세션 id 를 대조합니다.
      if (deadline.sessionId !== useSessionStore.getState().sessionId) return

      const alert = nextAlert({
        now,
        deadlineAt: deadline.taskDeadlineAt,
        enabled: deadline.alertsEnabled,
        completed: deadline.completed,
        shownStages: deadline.shownStages,
      })
      if (!alert) {
        pendingSinceRef.current = null
        return
      }

      // 회복 기회 또는 회복 연출 중이면 최대 5초 지연
      const recoveryActive =
        Boolean(usePostureStore.getState().snapshot.recoveryOpportunity?.active) ||
        useCharacterVisualStore.getState().intent === 'recover'
      pendingSinceRef.current ??= now
      if (shouldDelayForRecovery(recoveryActive, pendingSinceRef.current, now)) {
        return
      }

      pendingSinceRef.current = null
      deadline.markShown(alert)
      chirp()
    }, 1000)

    return () => window.clearInterval(timer)
  }, [active])
}
