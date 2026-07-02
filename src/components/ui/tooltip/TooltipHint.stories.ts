import type { Meta, StoryObj } from '@storybook/vue3-vite'

import TooltipHint from './TooltipHint.vue'
import Button from '@/components/ui/button/Button.vue'

const meta: Meta<typeof TooltipHint> = {
  title: 'Components/Tooltip/TooltipHint',
  component: TooltipHint,
  tags: ['autodocs'],
  args: {
    content: 'Tooltip hint',
    side: 'top',
    delayDuration: 300,
    disabled: false
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { TooltipHint, Button },
    setup() {
      return { args }
    },
    template: `
      <div class="flex items-center justify-center p-16">
        <TooltipHint v-bind="args">
          <Button variant="secondary">Hover me</Button>
        </TooltipHint>
      </div>
    `
  })
}

export const Disabled: Story = {
  args: {
    disabled: true,
    content: 'Hidden tooltip'
  },
  render: Default.render
}

export const IconButton: Story = {
  args: {
    content: 'Set start frame'
  },
  render: (args) => ({
    components: { TooltipHint },
    setup() {
      return { args }
    },
    template: `
      <div class="flex items-center justify-center p-16">
        <TooltipHint v-bind="args">
          <button
            type="button"
            class="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-component-node-widget-background text-component-node-foreground"
            aria-label="Set start frame"
          >
            <i class="icon-[lucide--skip-back] size-4" />
          </button>
        </TooltipHint>
      </div>
    `
  })
}
