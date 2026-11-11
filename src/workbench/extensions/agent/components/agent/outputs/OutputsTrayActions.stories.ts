import type { Meta, StoryObj } from '@storybook/vue3-vite'

import '@/workbench/extensions/agent/agentPanel.css'

import OutputsTrayActions from './OutputsTrayActions.vue'

const meta: Meta<typeof OutputsTrayActions> = {
  title: 'Agent/Outputs/OutputsTrayActions',
  component: OutputsTrayActions,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { selectedCount: 0, attachableCount: 0, downloadOnlyCount: 0 },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope w-100 bg-secondary p-4"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const NothingSelected: Story = {}

export const Selected: Story = {
  args: { selectedCount: 2, attachableCount: 2 }
}

export const SomeDownloadOnly: Story = {
  args: { selectedCount: 3, attachableCount: 2, downloadOnlyCount: 1 }
}

export const OnlyDownloadOnly: Story = {
  args: { selectedCount: 2, attachableCount: 0, downloadOnlyCount: 2 }
}
