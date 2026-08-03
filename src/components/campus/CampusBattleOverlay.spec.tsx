import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CampusBattleOverlay } from './CampusBattleOverlay'
import type { CampusBattleScene } from '@/features/campus/types'

const scene: CampusBattleScene = {
  eventId: 'battle-1',
  tileId: 'season-1:3-3',
  attackerSchoolId: 'yonsei',
  defenderSchoolId: 'hanyang',
  startedAt: 1000,
  expiresAt: 4000,
}

describe('CampusBattleOverlay', () => {
  it('renders a small giraffe and turtle for a battle scene', () => {
    render(
      <svg>
        <CampusBattleOverlay
          scene={scene}
          cell={{ x: 3, y: 3, points: '', cx: 515, cy: 480 }}
          attacker={{ name: '연세대', color: '#2E5B9A' }}
          defender={{ name: '한양대', color: '#315A96' }}
        />
      </svg>,
    )

    expect(screen.getByTestId('campus-battle-overlay')).toBeInTheDocument()
    expect(screen.getByText('연세대 공격')).toBeInTheDocument()
    expect(screen.getByText('한양대 방어')).toBeInTheDocument()
    expect(document.querySelector('.char-stage-6')).toBeInTheDocument()
    expect(document.querySelector('.char-stage-1')).toBeInTheDocument()
    expect(document.querySelector('.campus-battle-attacker')).toBeInTheDocument()
    expect(document.querySelector('.campus-battle-defender')).toBeInTheDocument()
  })

  it('renders no overlay when there is no scene', () => {
    const { container } = render(
      <svg>
        <CampusBattleOverlay
          scene={null}
          cell={{ x: 3, y: 3, points: '', cx: 515, cy: 480 }}
          attacker={null}
          defender={null}
        />
      </svg>,
    )

    expect(container.querySelector('[data-testid="campus-battle-overlay"]')).toBeNull()
  })
})
