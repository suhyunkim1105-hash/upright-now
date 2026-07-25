import { clearLocal } from '@/lib/storage/local'
import { useUserStore } from '@/features/onboarding/userStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useCalibrationStore } from '@/features/calibration/calibrationStore'
import { useSessionHistoryStore } from '@/features/sessions/sessionHistoryStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useGameStore } from '@/features/game/gameStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { resetRewardsForTest } from '@/features/game/rewards'
import { resetFinalizedForTest } from '@/features/sessions/finalizeSession'
import { useDeadlineStore } from '@/features/deadline/deadlineStore'

/**
 * 전체 로컬 데이터 초기화 — 첫 방문 상태로 돌아갑니다.
 * 닉네임·개인 기준·세션 기록·XP·포인트·출석·구매/장착 아이템·환경 모드 삭제.
 * (카메라 영상·프레임·랜드마크 원본은 애초에 저장하지 않습니다)
 */
export function resetAllData(): void {
  clearLocal()

  useDemoStore.setState({ isDemo: false })
  useUserStore.getState().reset()
  useProgressionStore.getState().reset()
  useCalibrationStore.getState().clear()
  useCalibrationStore.getState().setSensitivity('default')
  useSessionHistoryStore.getState().clear()
  useSessionStore.getState().reset()
  useGameStore.getState().reset()
  usePostureStore.getState().reset()
  resetRewardsForTest()
  resetFinalizedForTest()
  useDeadlineStore.getState().reset()

  // 스토어 reset 이 구독자를 통해 0 값을 다시 저장할 수 있으므로 한 번 더 비웁니다.
  clearLocal()
}
