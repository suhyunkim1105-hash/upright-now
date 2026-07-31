import { CharacterViewport } from '@/components/character/CharacterViewport'
import type { CampusGridCell } from '@/features/campus/campusGridOverlay'
import type { CampusBattleScene } from '@/features/campus/types'

interface SchoolBattleIdentity {
  name: string
  color: string
}

interface IdleBattleIdentity extends SchoolBattleIdentity {
  role: 'owner' | 'challenger'
}

export interface CampusBattleOverlayProps {
  scene: CampusBattleScene | null
  cell: CampusGridCell
  attacker: SchoolBattleIdentity | null
  defender: SchoolBattleIdentity | null
  idle?: IdleBattleIdentity | null
}

/** 지도 크기를 건드리지 않고 타일 위에만 짧게 표시하는 전투 연출입니다. */
export function CampusBattleOverlay({
  scene,
  cell,
  attacker,
  defender,
  idle = null,
}: CampusBattleOverlayProps) {
  if (!scene && !idle) return null

  if (!scene && idle) {
    return (
      <foreignObject
        data-testid="campus-idle-character"
        className="campus-idle-character"
        x={cell.cx - 30}
        y={cell.cy - 30}
        width="60"
        height="60"
        pointerEvents="none"
        aria-label={`${idle.name} 캐릭터`}
      >
        <div
          className="flex h-full w-full items-center justify-center rounded-full border-2 bg-white/70 p-0.5"
          style={{ borderColor: idle.color }}
        >
          <CharacterViewport
            stage={idle.role === 'challenger' ? 6 : 1}
            postureState="good"
            visualState="idle"
            size={52}
            decorative
          />
        </div>
      </foreignObject>
    )
  }

  const attackerName = attacker?.name ?? '미확인 학교'
  const defenderName = defender?.name ?? '중립'
  const attackerColor = attacker?.color ?? '#5F8FF7'
  const defenderColor = defender?.color ?? '#9A9488'

  return (
    <foreignObject
      data-testid="campus-battle-overlay"
      className="campus-battle-overlay"
      x={cell.cx - 110}
      y={cell.cy - 70}
      width="220"
      height="140"
      pointerEvents="none"
      aria-label={`${attackerName} 공격, ${defenderName} 방어`}
    >
      <div className="flex h-full w-full items-center justify-center gap-2 overflow-hidden rounded-xl">
        <div
          className="campus-battle-fighter campus-battle-attacker relative h-[100px] w-[100px] rounded-full border-2 bg-white/75 p-0.5"
          style={{ borderColor: attackerColor }}
        >
          <CharacterViewport
            stage={6}
            postureState="good"
            visualState="attack"
            attackTick={1}
            attackDurationMs={2600}
            size={94}
            decorative
          />
          <span className="sr-only">{`${attackerName} 공격`}</span>
        </div>
        <div
          className="campus-battle-fighter campus-battle-defender relative h-[100px] w-[100px] rounded-full border-2 bg-white/75 p-0.5"
          style={{ borderColor: defenderColor }}
        >
          <CharacterViewport
            stage={1}
            postureState="good"
            visualState="idle"
            size={94}
            decorative
          />
          <span className="sr-only">{`${defenderName} 방어`}</span>
        </div>
      </div>
    </foreignObject>
  )
}
