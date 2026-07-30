import { NavLink } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { SIDEBAR_ITEMS, CAMPUS_NAV_ITEM, ROUTES } from '@/constants/routes'
import { BRAND, PRIVACY } from '@/constants/copy'
import { Icon } from '@/components/ui/Icon'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { useUserStore } from '@/features/onboarding/userStore'
import { useDemoStore } from '@/features/demo/demoMode'
import {
  useCharacterStage,
  useProgressionStore,
} from '@/features/progression/progressionStore'
import { getStageMeta } from '@/features/progression/growth'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useCampusTheme } from '@/features/campus/campusThemeStore'
import { CampusProfileBadge } from '@/components/campus/CampusBits'

/** 세션 밖 사이드바 — docs/04_IA.md §3, docs/05 S-01 */
export function SidebarNavigation() {
  const nickname = useUserStore((s) => s.nickname)
  const isDemo = useDemoStore((s) => s.isDemo)
  const stage = useCharacterStage()
  const points = useProgressionStore((s) => s.points)
  const meta = getStageMeta(stage)
  const campusTheme = useCampusTheme()

  /**
   * 캠퍼스 테마가 켜져 있으면 선택 색을 학교 색으로 바꿉니다.
   * 꺼져 있으면 undefined 를 돌려주어 기존 핑크 선택색이 그대로 유지됩니다.
   */
  const activeStyle = (isActive: boolean): CSSProperties | undefined => {
    if (!isActive || !featureFlags.campusTheme || !campusTheme) return undefined
    return { backgroundColor: campusTheme.soft, color: campusTheme.deep }
  }

  const navItems = featureFlags.campusTerritory
    ? [...SIDEBAR_ITEMS.slice(0, -1), CAMPUS_NAV_ITEM, SIDEBAR_ITEMS[SIDEBAR_ITEMS.length - 1]]
    : SIDEBAR_ITEMS

  return (
    <aside className="flex w-[232px] shrink-0 flex-col gap-6 border-r border-line bg-canvas px-4 py-6">
      <div className="px-2">
        <p className="text-xl font-bold tracking-tight text-ink">{BRAND.name}</p>
        <p className="mt-0.5 text-[11px] text-ink-soft">{BRAND.slogan}</p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5">
        <CharacterViewport stage={stage} size={40} decorative />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
            {nickname}
            {isDemo && (
              <button
                type="button"
                title="데모를 끝내고 내 데이터로 돌아갑니다"
                onClick={() => useDemoStore.getState().disableDemo()}
                className="rounded-full bg-blue-soft px-1.5 py-0.5 text-[10px] font-bold text-[#2b52a8] hover:bg-blue-soft/70"
              >
                데모 종료
              </button>
            )}
          </p>
          <p className="truncate text-[11px] text-ink-soft">
            {`Lv.${meta.stage} ${meta.name}`}
          </p>
          {/* 프로필 학교 배지 — 캠퍼스 테마가 꺼져 있으면 렌더되지 않습니다. */}
          <div className="mt-1 empty:hidden">
            <CampusProfileBadge />
          </div>
        </div>
      </div>

      <nav aria-label="주 메뉴" className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === ROUTES.home}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-semibold transition',
                isActive
                  ? 'bg-pink-soft text-[#b8285a]'
                  : 'text-ink-soft hover:bg-surface hover:text-ink',
              ].join(' ')
            }
            style={({ isActive }) => activeStyle(isActive)}
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}

        {featureFlags.qaLab && (
          <NavLink
            to={ROUTES.lab}
            className={({ isActive }) =>
              [
                'mt-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-semibold transition',
                isActive
                  ? 'bg-blue-soft text-[#2b52a8]'
                  : 'text-ink-soft hover:bg-surface hover:text-ink',
              ].join(' ')
            }
          >
            <Icon name="star" />
            QA Lab
          </NavLink>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-2xl bg-green-soft px-3 py-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-green">
            <Icon name="shield" size={16} />
            {PRIVACY.title}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
            {PRIVACY.body}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-yellow-soft px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-[#725500]">
            <Icon name="leaf" size={16} />
            잎사귀 포인트
          </span>
          <span className="tabular text-sm font-bold text-ink">{points}</span>
        </div>
      </div>
    </aside>
  )
}
