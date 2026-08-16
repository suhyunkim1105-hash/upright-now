import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppRoutes } from './router/AppRoutes'
import { ToastProvider } from './providers/ToastProvider'
import { PostureGameBridge } from './providers/PostureGameBridge'
import { useDemoBootstrap } from '@/features/demo/useDemoBootstrap'
import { installDevApi } from '@/features/qa-lab/devApi'
import { installPersistence } from '@/features/persistence/persist'
import { unlockAudio } from '@/features/sound/soundEngine'
import { installSoundTriggers } from '@/features/sound/soundTriggers'
import { installMonsterBridge } from '@/features/game/monsterBridge'
import { CampusThemeRoot } from '@/components/campus/CampusThemeRoot'
import { CampusContributionBridge } from '@/features/campus/CampusContributionBridge'
import { CampusFeedbackToaster } from '@/components/campus/CampusFeedbackToaster'
import { installCampusDevApi } from '@/features/campus/campusDevApi'
import { repairProgressionFromHistory } from '@/features/progression/repairProgression'
import { hydrateProgressionFromServer } from '@/features/progression/progressionRepository'
import { consumeAuthCallback } from '@/lib/supabase/client'
import { ROUTES } from '@/constants/routes'

/**
 * Supabase 메일 링크가 Site URL(`/`)로 돌아오는 경우도 캠퍼스 인증으로 연결합니다.
 * 링크 콜백은 캠퍼스 화면이 아니라 앱 전체 진입점에서 먼저 소비해야 합니다.
 */
function CampusAuthCallbackBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    const pending = localStorage.getItem('upright-now:campus:verification-pending')
    const hasCode = new URLSearchParams(window.location.search).has('code')
    const hasToken = /(?:access_token|refresh_token|type=)/.test(window.location.hash)
    if (!pending && !hasCode && !hasToken) return

    void consumeAuthCallback().then((authenticated) => {
      if (!authenticated) return
      // 앱 초기화보다 인증 콜백이 늦게 끝나는 경우에도 서버 성장 잔액을 즉시 복원합니다.
      void hydrateProgressionFromServer()
      if (window.location.pathname !== ROUTES.campus) navigate(ROUTES.campus, { replace: true })
    })
  }, [navigate])

  return null
}

export function App() {
  // ?demo=1 또는 /lab 에서만 데모 값을 채웁니다.
  useDemoBootstrap()

  // 실제 사용자 데이터를 localStorage 에 저장합니다. (데모 값은 제외)
  useEffect(() => {
    const uninstall = installPersistence()
    installDevApi()
    installCampusDevApi()
    // 완료 기록 대비 상점 잠금·완료 수가 뒤처졌으면 자동 복구합니다.
    repairProgressionFromHistory()
    void hydrateProgressionFromServer()
    // 효과음: 사용자 제스처 후에만 AudioContext 시작 (자동 재생 금지)
    window.addEventListener('pointerdown', unlockAudio)
    const uninstallSound = installSoundTriggers()
    const uninstallMonster = installMonsterBridge()
    return () => {
      uninstall()
      window.removeEventListener('pointerdown', unlockAudio)
      uninstallSound()
      uninstallMonster()
    }
  }, [])

  return (
    <ToastProvider>
      {/* 자세 이벤트 → 게임 반응. UI 없음 */}
      <PostureGameBridge />
      {/* 캠퍼스 테마 색 주입 · 기여 이벤트 관찰. 플래그가 꺼져 있으면 아무 일도 하지 않습니다. */}
      <CampusThemeRoot />
      <CampusContributionBridge />
      <CampusFeedbackToaster />
      <CampusAuthCallbackBridge />
      <AppRoutes />
    </ToastProvider>
  )
}
