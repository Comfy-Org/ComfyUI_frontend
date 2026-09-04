import type { Meta, StoryObj } from '@storybook/vue3-vite'

import '../../agentPanel.css'

import PanelHeader from './PanelHeader.vue'

const meta: Meta<typeof PanelHeader> = {
  title: 'Agent/PanelHeader',
  component: PanelHeader,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope bg-agent-surface-raised w-100 overflow-hidden rounded-xl"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Maximized: Story = {
  args: { isMaximized: true }
}
