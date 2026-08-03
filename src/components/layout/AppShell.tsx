import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { SidebarNavigation } from './SidebarNavigation'

/**
 * 화면 골격.
 * - full: 사이드바 + 중앙 + 오른쪽 레일 (docs/12 §7)
 * - focus: 세션 중. 사이드바를 숨기고 단순하게 (docs/04 §3)
 */
export function AppShell({
  children,
  rail,
  chrome = 'full',
}: {
  children: ReactNode
  rail?: ReactNode
  chrome?: 'full' | 'focus'
}) {
  if (chrome === 'focus') {
    return (
      <div className="min-h-dvh bg-canvas">
        <main className="mx-auto w-full max-w-[1100px] px-5 py-7 sm:px-6 sm:py-8">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh bg-canvas">
      <SidebarNavigation />
      <div className="mx-auto flex w-full max-w-[1560px] gap-8 px-5 py-6 lg:px-7 lg:py-8">
        {/*
          @container: 카드 내부 배치를 뷰포트가 아니라 "본문 실제 폭" 기준으로
          바꿉니다. 1280 처럼 오른쪽 레일이 함께 보이는 폭에서 카드가 넘치지 않습니다.
        */}
        <main className="@container min-w-0 max-w-[980px] flex-1">{children}</main>
        {rail && (
          <aside className="hidden w-[280px] shrink-0 flex-col gap-5 xl:flex" aria-label="오늘의 보조 정보">
            {rail}
          </aside>
        )}
      </div>
    </div>
  )
}

/**
 * 앱 내부 뒤로가기 버튼.
 * - 히스토리가 있으면 한 단계 뒤로, 없으면(새 탭·직접 진입) fallback 으로.
 * - onClick 을 주면 화면이 직접 처리합니다 (예: 세션 이탈 확인 모달).
 */
export function BackButton({
  fallback = '/',
  onClick,
}: {
  fallback?: string
  onClick?: () => void
}) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onClick) {
      onClick()
      return
    }
    // react-router 는 history.state.idx 로 스택 위치를 추적합니다.
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate(fallback)
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="mb-3 inline-flex items-center gap-1.5 rounded-xl px-2 py-1 -ml-2 text-sm font-semibold text-ink-soft transition hover:bg-surface hover:text-ink"
      aria-label="이전 화면으로"
    >
      <span aria-hidden="true">←</span>
      이전
    </button>
  )
}

/** 화면 상단 제목 블록 */
export function PageHeader({
  title,
  description,
  action,
  back,
}: {
  title: string
  description?: string
  action?: ReactNode
  /** 뒤로가기 — 문자열이면 히스토리 없을 때의 fallback 경로, 함수면 직접 처리 */
  back?: string | (() => void)
}) {
  // flex-wrap: 좁은 폭에서 action 이 제목 아래로 내려가 가로 넘침을 막습니다.
  return (
    <header className="mb-6">
      {back !== undefined &&
        (typeof back === 'string' ? (
          <BackButton fallback={back} />
        ) : (
          <BackButton onClick={back} />
        ))}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
          {description && (
            <p className="mt-1.5 text-[15px] text-ink-soft">{description}</p>
          )}
        </div>
        {action}
      </div>
    </header>
  )
}
