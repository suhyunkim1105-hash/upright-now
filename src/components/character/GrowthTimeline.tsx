import { CHARACTER_STAGES } from '@/constants/game'
import { getStageProgress } from '@/features/progression/growth'
import { Progress } from '@/components/ui'

export function GrowthTimeline({
  xp,
}: {
  xp: number
  compact?: boolean
}) {
  const progress = getStageProgress(xp)

  return (
    <section className="growth-timeline" aria-labelledby="growth-timeline-title">
      <div className="growth-timeline__header">
        <div>
          <p className="dashboard-kicker">자세를 회복할 때마다</p>
          <h2 id="growth-timeline-title" className="mt-1 text-xl font-bold text-ink">
            조금씩 길어지는 여정
          </h2>
        </div>
        <p className="growth-timeline__level">
          <span>지금</span>
          {` Lv.${progress.stage} ${progress.meta.name}`}
        </p>
      </div>

      <ol className="growth-timeline__stages" aria-label="캐릭터 6단계 성장">
        {CHARACTER_STAGES.map((meta) => {
          const reached = meta.stage <= progress.stage
          const current = meta.stage === progress.stage
          return (
            <li
              key={meta.stage}
              aria-current={current ? 'step' : undefined}
              className={[
                'growth-timeline__stage',
                reached ? 'growth-timeline__stage--reached' : '',
                current ? 'growth-timeline__stage--current' : '',
              ].join(' ')}
            >
              <span className="growth-timeline__node" aria-hidden="true">{meta.stage}</span>
              <span className="growth-timeline__name">{meta.name}</span>
            </li>
          )
        })}
      </ol>

      <div className="growth-timeline__progress">
        <Progress
          value={progress.ratio}
          tone="blue"
          label="다음 성장 단계까지의 경험치"
        />
        <div className="flex justify-between text-xs text-ink-soft">
          <span>
            {progress.isMax
              ? '마지막 단계에 도달했어요'
              : `다음 단계까지 ${progress.remainingXp} XP`}
          </span>
          <span className="tabular">
            {progress.isMax
              ? `${xp} XP`
              : `${xp} / ${progress.nextMeta?.requiredXp} XP`}
          </span>
        </div>
      </div>
    </section>
  )
}
