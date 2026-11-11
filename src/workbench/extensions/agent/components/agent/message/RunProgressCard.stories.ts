import type { Meta, StoryObj } from '@storybook/vue3-vite'

import '@/workbench/extensions/agent/agentPanel.css'

import RunProgressCard from './RunProgressCard.vue'

const meta: Meta<typeof RunProgressCard> = {
  title: 'Agent/RunProgressCard',
  component: RunProgressCard,
  parameters: { layout: 'padded' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope bg-secondary w-100 p-4"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Starting: Story = {
  args: { view: 'starting' }
}

export const Running: Story = {
  args: { view: 'running' }
}

export const NotStarted: Story = {
  args: { view: 'notStarted' }
}

export const Ran: Story = {
  args: { view: 'ran' }
}

export const RanInSeconds: Story = {
  args: { view: 'ran', durationMs: 42_000 }
}

export const RanInMinutes: Story = {
  args: { view: 'ran', durationMs: 72_000 }
}

export const Requested: Story = {
  args: { view: 'requested' }
}
