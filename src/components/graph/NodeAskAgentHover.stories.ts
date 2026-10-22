import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent } from 'storybook/test'

import { t } from '@/i18n'
import NodeAskAgentHover from '@/components/graph/NodeAskAgentHover.vue'
import TooltipProvider from '@/components/ui/tooltip/TooltipProvider.vue'
import { toNodeId } from '@/types/nodeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const meta: Meta<typeof NodeAskAgentHover> = {
  title: 'Graph/NodeAskAgentHover',
  component: NodeAskAgentHover,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    nodeId: toNodeId(12),
    alwaysVisible: true
  },
  decorators: [
    () => ({
      components: { TooltipProvider },
      setup() {
        useAgentPanelStore().enabled = true
        return {}
      },
      template: `
        <TooltipProvider :delay-duration="0">
          <div class="min-h-72 min-w-[780px] bg-background p-8">
            <div
              class="group/node relative w-80 rounded-xl border border-border bg-secondary text-foreground"
            >
              <div class="px-2 py-1.5 text-xs">ModelSamplingAuraFlow</div>
              <div
                class="rounded-b-xl px-3 py-2 text-xs text-muted-foreground"
              >
                <div class="flex justify-between">
                  <span>model</span>
                  <span>MODEL</span>
                </div>
              </div>
              <story />
            </div>
          </div>
        </TooltipProvider>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const FloatingButton: Story = {}

export const ComposerOpen: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: t('agent.askAgent') })
    )
    await expect(
      canvas.getByRole('textbox', { name: t('agent.nodeHover.placeholder') })
    ).toHaveFocus()
  }
}

export const PartnerComposerOpen: Story = {
  args: { isPartner: true },
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: t('agent.askAgent') })
    )
    await expect(
      canvas.getByRole('button', { name: t('agent.nodeHover.enhance') })
    ).toBeVisible()
  }
}
