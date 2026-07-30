import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card, CardTitle, StatTile } from './index'

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: (
      <>
        <CardTitle>오늘의 기록</CardTitle>
        <p className="mt-2 text-sm text-ink-soft">
          세션을 마치면 집중 시간과 회복 행동이 여기에 쌓여요.
        </p>
      </>
    ),
  },
}

export const Tones: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
      {(['surface', 'pink', 'yellow', 'blue', 'green', 'canvas', 'coral'] as const).map(
        (tone) => (
          <Card key={tone} tone={tone} className="p-4">
            <CardTitle>{tone}</CardTitle>
            <p className="mt-1 text-sm text-ink-soft">상태와 정보 위계에 따라 쓰는 표면입니다.</p>
          </Card>
        ),
      )}
    </div>
  ),
}

export const StatTiles: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="grid w-[32rem] grid-cols-3 gap-3">
      <StatTile label="집중" value="25:00" tone="blue" />
      <StatTile label="회복" value="4" unit="회" tone="green" />
      <StatTile label="포인트" value="120" unit="P" tone="yellow" />
    </div>
  ),
}
