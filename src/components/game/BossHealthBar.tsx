import { useEffect, useRef, useState } from 'react'
import { BOSS_NAME, BOSS_PHASE_LABEL, getBossPhase } from '@/constants/game'
import { resolveBossAsset } from '@/assets/manifest/bossAssetManifest'
import { Progress } from '@/components/ui'
import { usePrefersReducedMotion } from '@/lib/a11y/useReducedMotion'

/**
 * 마감괴수 D-DAY — HP 에 따라 4단계 외형이 바뀝니다. (docs/07 §6)
 * 에셋이 없으면 기존 D-DAY 카드 아이콘 폴백을 유지합니다.
 * 피격: 180ms 흔들림 + 코랄 충격 링 + 종이 조각 + 피해량 숫자.
 * reduced-motion 에서는 흔들림·조각 없이 링과 수치만 보여줍니다.
 */
export function BossHealthBar({
  hp,
  maxHp,
  attackTick = 0,
}: {
  hp: number
  maxHp: number
  attackTick?: number
}) {
  const phase = getBossPhase(hp, maxHp)
  const ratio = Math.max(0, hp / maxHp)
  const reducedMotion = usePrefersReducedMotion()

  const [hit, setHit] = useState(false)
  const [lastDamage, setLastDamage] = useState<number | null>(null)
  const prevHpRef = useRef(hp)
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set())

  // 피해량 = HP 감소분 (gameStore 의 HP 로직을 그대로 사용, 별도 store 없음)
  useEffect(() => {
    const delta = prevHpRef.current - hp
    prevHpRef.current = hp
    if (delta > 0) setLastDamage(delta)
  }, [hp])

  useEffect(() => {
    if (attackTick <= 0) return
    setHit(true)
    const timer = window.setTimeout(() => {
      setHit(false)
      setLastDamage(null)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [attackTick])

  const { src } = resolveBossAsset(hp, maxHp)
  const useImage = !broken.has(src)
  const face =
    phase === 'defeated' ? '제출 완료' : phase === 'rage' ? '23:59' : 'D-DAY'

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <div
          data-boss-phase={phase}
          className={[
            'flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-2',
            phase === 'defeated'
              ? 'border-line bg-canvas text-muted'
              : phase === 'rage'
                ? 'border-coral bg-pink-soft text-[#b8285a]'
                : 'border-line bg-surface text-ink',
            hit && !reducedMotion ? 'anim-boss-shake' : '',
          ].join(' ')}
        >
          {useImage ? (
            <img
              src={src}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="h-full w-full object-contain"
              onError={() =>
                setBroken((prev) => new Set(prev).add(src))
              }
            />
          ) : (
            // 에셋 폴백 — 기존 D-DAY 카드
            <span className="flex flex-col items-center" aria-hidden="true">
              <span className="text-[10px] font-bold">📄</span>
              <span className="tabular text-[11px] font-bold">{face}</span>
            </span>
          )}
        </div>

        {/* 피격 연출 오버레이 */}
        {hit && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span className="boss-impact-ring absolute inset-0 rounded-2xl" />
            {!reducedMotion && (
              <>
                <span className="boss-paper boss-paper-1" />
                <span className="boss-paper boss-paper-2" />
                <span className="boss-paper boss-paper-3" />
                <span className="boss-paper boss-paper-4" />
              </>
            )}
            {lastDamage !== null && (
              <span className="boss-damage-number tabular">{`-${lastDamage}`}</span>
            )}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-bold text-ink">{BOSS_NAME}</p>
          <p className="tabular text-xs font-semibold text-ink-soft">
            {`${Math.max(0, hp)} / ${maxHp}`}
          </p>
        </div>

        <div className="mt-1.5">
          <Progress
            thick
            value={ratio}
            tone={phase === 'rage' ? 'coral' : 'pink'}
            label={`${BOSS_NAME} 체력`}
          />
        </div>

        <p className="mt-1 text-xs text-ink-soft">{BOSS_PHASE_LABEL[phase]}</p>
      </div>
    </div>
  )
}
