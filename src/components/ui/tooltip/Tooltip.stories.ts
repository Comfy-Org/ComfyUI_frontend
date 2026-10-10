import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'

import Tooltip from './Tooltip.vue'
import TooltipContent from './TooltipContent.vue'
import TooltipTrigger from './TooltipTrigger.vue'

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { disabled: false },
  render: (args) => ({
    components: { Button, Tooltip, TooltipContent, TooltipTrigger },
    setup: () => ({ args }),
    template: `
      <Tooltip v-bind="args">
        <TooltipTrigger as-child>
          <Button variant="secondary">Hover or focus</Button>
        </TooltipTrigger>
        <TooltipContent>Add to library</TooltipContent>
      </Tooltip>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sides: Story = {
  render: () => ({
    components: { Button, Tooltip, TooltipContent, TooltipTrigger },
    setup: () => ({ sides: ['top', 'right', 'bottom', 'left'] as const }),
    template: `
      <div class="flex gap-4">
        <Tooltip v-for="side in sides" :key="side">
          <TooltipTrigger as-child>
            <Button variant="secondary">{{ side }}</Button>
          </TooltipTrigger>
          <TooltipContent :side>Placed {{ side }}</TooltipContent>
        </Tooltip>
      </div>
    `
  })
}

export const OnButton: Story = {
  render: () => ({
    components: { Button },
    template: `
      <Button
        tooltip="Delete the selected nodes"
        tooltip-side="bottom"
        variant="muted-textonly"
        size="icon"
        aria-label="Delete"
      >
        <i class="icon-[lucide--trash-2]" />
      </Button>
    `
  })
}
