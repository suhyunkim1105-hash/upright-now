import type { Meta, StoryObj } from '@storybook/react-vite'
import { AiReportCard } from './AiReportCard'
import type { AiSessionReport, SessionSummary } from '@/types'

const reportFixture: AiSessionReport = {
  headline: '이번 흐름을 짧게 정리했어요.',
  stats: [
      { label: '앉은 시간', value: '21분 / 25분' },
      { label: '잰 시간', value: '18분' },
      { label: '돌아온 횟수', value: '4번' },
    ],
    observations: [],
    followUps: [],
    nextAction: {
    title: '2분 정리 후 다시 시작',
    instruction: '물 한 모금과 다음 할 일을 적고 2분 안에 시작해 보세요.',
    because: '이번 세션 이탈이 화면과의 거리에 몰렸어요',
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
