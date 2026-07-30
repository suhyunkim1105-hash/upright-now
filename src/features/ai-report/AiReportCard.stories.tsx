import type { Meta, StoryObj } from '@storybook/react-vite'
import { AiReportCard } from './AiReportCard'
import type { AiSessionReport, SessionSummary } from '@/types'

const reportFixture: AiSessionReport = {
  headline: '이번 흐름을 짧게 정리했어요.',
  reflection: '계획한 집중 흐름을 끝까지 이어 갔고, 필요할 때 다시 자리에 앉아 다음 행동을 준비했어요.',
  highlights: [
    { label: '집중 시간', detail: '계획한 흐름을 끝까지 이어 갔어요.' },
    { label: '회복 행동', detail: '필요할 때 다시 흐름을 만들었어요.' },
    { label: '다음 시도', detail: '짧은 단위로 바로 이어 가기 좋아요.' },
  ],
  nextAction: {
    title: '2분 정리 후 다시 시작',
    instruction: '물 한 모금과 다음 할 일을 적고 2분 안에 시작해 보세요.',
    durationMinutes: 2,
  },
}

const summaryFixture: SessionSummary = {
  id: 'storybook-session',
  sessionId: 'storybook-session',
  startedAt: Date.UTC(2026, 6, 30, 10, 0),
  endedAt: Date.UTC(2026, 6, 30, 10, 25),
  status: 'completed',
  plannedDurationMs: 25 * 60_000,
  elapsedMs: 25 * 60_000,
  detectableMs: 23 * 60_000,
  awayMs: 2 * 60_000,
  unstableMs: 0,
  recoveryOpportunities: 3,
  recoveries: 3,
  bestCombo: 3,
  damageDealt: 96,
  xpEarned: 60,
  pointsEarned: 30,
  aiReport: reportFixture,
}

const meta = {
  title: 'Features/AI session report',
  component: AiReportCard,
  args: {
    summary: summaryFixture,
    onSave: () => undefined,
  },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof AiReportCard>

export default meta
type Story = StoryObj<typeof meta>

export const CompletedReport: Story = {}
