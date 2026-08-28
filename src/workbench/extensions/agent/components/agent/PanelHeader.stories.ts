import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PanelHeader from './PanelHeader.vue'

const meta: Meta<typeof PanelHeader> = {
  title: 'Agent/Linear UX/PanelHeader',
  component: PanelHeader,
  parameters: { layout: 'padded' },
  decorators: [
    () => ({
      template:
        '<div class="bg-agent-surface-raised w-[400px] overflow-hidden rounded-xl"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

/** T-19 / PM-668 / FE-1286: unsaved label stays directly below the panel header. */
export const T19UnsavedWorkflowLabel: Story = {
  render: () => ({
    components: { PanelHeader },
    template: `
      <div>
        <PanelHeader />
        <div class="border-agent-border text-agent-fg-muted border-b px-4 py-2 text-xs">
          Unsaved workflow
        </div>
      </div>
    `
  })
}
