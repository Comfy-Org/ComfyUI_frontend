import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref } from 'vue'

import { t } from '@/i18n'
import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import TooltipProvider from '@/components/ui/tooltip/TooltipProvider.vue'

import AskAgentButton from './AskAgentButton.vue'

const meta: Meta<typeof AskAgentButton> = {
  title: 'Graph/SelectionToolbox/AskAgent',
  component: AskAgentButton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Toolbar: Story = {
  render: () => ({
    components: { AskAgentButton, Button, TooltipProvider },
    setup() {
      return { t }
    },
    template: `
      <TooltipProvider :delay-duration="0">
      <div
        data-testid="selection-toolbox"
        class="selection-toolbox pointer-events-auto floating-panel"
      >
        <div class="flex h-8 gap-1">
          <Button
            :tooltip="t('commands.Comfy_Canvas_DeleteSelectedItems.label')"
            variant="muted-textonly"
            :aria-label="t('commands.Comfy_Canvas_DeleteSelectedItems.label')"
          >
            <i class="icon-[lucide--trash-2]" />
          </Button>
          <div class="h-6 w-px self-center bg-border" />
          <Button
            :tooltip="t('g.info')"
            variant="muted-textonly"
            :aria-label="t('g.info')"
          >
            <i class="icon-[lucide--info]" />
          </Button>
          <Button
            :tooltip="t('g.color')"
            variant="muted-textonly"
            :aria-label="t('g.color')"
          >
            <div class="flex items-center gap-1 px-0">
              <i class="pi pi-circle-fill" />
              <i class="icon-[lucide--chevron-down]" />
            </div>
          </Button>
          <Button
            :tooltip="t('commands.Comfy_Graph_ConvertToSubgraph.label')"
            variant="muted-textonly"
            size="icon"
            :aria-label="t('commands.Comfy_Graph_ConvertToSubgraph.label')"
          >
            <i class="icon-[lucide--shrink] size-4" />
          </Button>
          <div class="h-6 w-px self-center bg-border" />
          <Button
            :tooltip="t('commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label')"
            variant="muted-textonly"
            :aria-label="t('commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label')"
          >
            <i class="icon-[lucide--redo-dot] size-4" />
          </Button>
          <AskAgentButton />
          <Button
            :tooltip="t('g.moreOptions')"
            variant="muted-textonly"
            :aria-label="t('g.moreOptions')"
          >
            <i class="icon-[lucide--more-vertical]" />
          </Button>
        </div>
      </div>
      </TooltipProvider>
    `
  })
}

export const MoreMenu: Story = {
  parameters: { layout: 'padded' },
  render: () => ({
    components: { AskAgentButton, Button, Menu, TooltipProvider },
    setup() {
      const open = ref(true)
      const items: MenuItem[] = [
        { label: t('contextMenu.Rename'), command: fn() },
        { label: t('contextMenu.Copy'), shortcut: 'Ctrl+C', command: fn() },
        {
          label: t('contextMenu.Duplicate'),
          shortcut: 'Ctrl+D',
          command: fn()
        },
        { separator: true },
        {
          label: t('agent.referenceInAgent'),
          icon: 'icon-[lucide--astroid]',
          command: fn()
        },
        { separator: true },
        { label: t('contextMenu.Delete'), icon: 'icon-[lucide--trash-2]' }
      ]
      return { t, open, items }
    },
    template: `
      <TooltipProvider :delay-duration="0">
        <div class="flex min-h-80 items-start justify-center pt-8">
          <div
            data-testid="selection-toolbox"
            class="selection-toolbox pointer-events-auto floating-panel"
          >
            <div class="flex h-8 gap-1">
              <Button variant="muted-textonly" :aria-label="t('g.info')">
                <i class="icon-[lucide--info]" />
              </Button>
              <AskAgentButton />
              <Menu v-model:open="open" :items="items" align="end">
                <template #trigger>
                  <Button
                    variant="muted-textonly"
                    :aria-label="t('g.moreOptions')"
                    data-testid="more-options-button"
                  >
                    <i class="icon-[lucide--more-vertical]" />
                  </Button>
                </template>
              </Menu>
            </div>
          </div>
        </div>
      </TooltipProvider>
    `
  })
}
