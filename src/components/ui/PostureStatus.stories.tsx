import type { Meta, StoryObj } from '@storybook/react-vite'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { PostureMessage, PostureStatusBadge } from '@/components/posture/PostureStatusBadge'
import type { DetectionQuality, PostureState } from '@/types'

const POSTURE_STATES: Array<{
  state: PostureState
  quality?: DetectionQuality
}> = [
  { state: 'good', quality: 'good' },
  { state: 'warning', quality: 'limited' },
  { state: 'bad', quality: 'good' },
  { state: 'away', quality: 'good' },
  { state: 'unstable', quality: 'unavailable' },
]

const meta = {
  title: 'Status/Posture and character',
  component: PostureStatusBadge,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof PostureStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const PostureStates: Story = {
  args: {
    state: 'good',
  },
  render: () => (
    <div className="grid max-w-3xl gap-3">
      {POSTURE_STATES.map(({ state, quality }) => (
        <article key={state} className="rounded-card border border-line bg-surface p-4">
          <PostureStatusBadge state={state} quality={quality} />
          <div className="mt-2">
            <PostureMessage state={state} />
          </div>
        </article>
      ))}
    </div>
  ),
}

export const CharacterVisualStates: Story = {
  args: {
    state: 'good',
  },
  render: () => (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
      <article className="rounded-card border border-line bg-surface p-4">
        <CharacterViewport stage={1} postureState="good" size={168} decorative />
        <p className="mt-3 text-sm font-bold text-ink">Lv.1 · 편안한 상태</p>
      </article>
      <article className="rounded-card border border-line bg-surface p-4">
        <CharacterViewport stage={3} postureState="bad" size={168} decorative />
        <p className="mt-3 text-sm font-bold text-ink">Lv.3 · 회복 기회</p>
      </article>
      <article className="rounded-card border border-line bg-surface p-4">
        <CharacterViewport
          stage={6}
          postureState="good"
          visualState="recover"
          size={168}
          decorative
        />
        <p className="mt-3 text-sm font-bold text-ink">Lv.6 · 회복 연출</p>
      </article>
    </div>
  ),
}
