import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './index'

const meta = {
  title: 'UI/Button',
  component: Button,
  args: {
    children: '집중 세션 시작',
  },
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: '나중에 하기',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    children: '카메라 기준을 먼저 등록해요',
  },
}

export const VariantsAndSizes: Story = {
  render: () => (
    <div className="grid min-w-[34rem] grid-cols-3 items-center gap-4">
      {(['primary', 'secondary', 'ghost', 'soft'] as const).map((variant) => (
        <Button key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Button key={size} size={size} variant="secondary">
          {size}
        </Button>
      ))}
    </div>
  ),
}
