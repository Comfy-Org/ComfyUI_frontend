import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { TooltipProvider } from 'reka-ui'

import BaseTooltip from './BaseTooltip.vue'
import { FOR_STORIES } from './tooltip.variants'

const { sizes, sides } = FOR_STORIES

const meta: Meta<typeof BaseTooltip> = {
  title: 'Components/Tooltip/BaseTooltip',
  component: BaseTooltip,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      components: { TooltipProvider, story },
      template:
        '<TooltipProvider :delay-duration="0"><div class="flex items-center justify-center p-20"><story /></div></TooltipProvider>'
    })
  ],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: sizes
    },
    side: {
      control: { type: 'select' },
      options: sides
    },
    text: { control: 'text' },
    keybind: { control: 'text' },
    showIcon: { control: 'boolean' },
    disabled: { control: 'boolean' }
  },
  args: {
    size: 'small',
    side: 'top',
    text: 'Tooltip text',
    disabled: false
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Small: Story = {
  render: (args) => ({
    components: { BaseTooltip },
    setup: () => ({ args }),
    template: `
      <BaseTooltip v-bind="args">
        <button class="rounded-lg bg-secondary-background px-4 py-2 text-sm">
          Hover me
        </button>
      </BaseTooltip>`
  })
}

export const Large: Story = {
  args: {
    size: 'large',
    text: 'This is a longer tooltip that can wrap to multiple lines for detailed descriptions of node functionality.'
  },
  render: (args) => ({
    components: { BaseTooltip },
    setup: () => ({ args }),
    template: `
      <BaseTooltip v-bind="args">
        <button class="rounded-lg bg-secondary-background px-4 py-2 text-sm">
          Hover me
        </button>
      </BaseTooltip>`
  })
}

export const WithKeybind: Story = {
  args: {
    text: 'Undo',
    keybind: 'Ctrl+Z'
  },
  render: (args) => ({
    components: { BaseTooltip },
    setup: () => ({ args }),
    template: `
      <BaseTooltip v-bind="args">
        <button class="rounded-lg bg-secondary-background px-4 py-2 text-sm">
          Hover me
        </button>
      </BaseTooltip>`
  })
}

export const WithIcon: Story = {
  args: {
    text: 'More options',
    showIcon: true,
    size: 'small'
  },
  render: (args) => ({
    components: { BaseTooltip },
    setup: () => ({ args }),
    template: `
      <BaseTooltip v-bind="args">
        <button class="rounded-lg bg-secondary-background px-4 py-2 text-sm">
          Hover me
        </button>
      </BaseTooltip>`
  })
}

export const WithKeybindAndIcon: Story = {
  args: {
    text: 'Save',
    keybind: 'Ctrl+S',
    showIcon: true,
    size: 'small'
  },
  render: (args) => ({
    components: { BaseTooltip },
    setup: () => ({ args }),
    template: `
      <BaseTooltip v-bind="args">
        <button class="rounded-lg bg-secondary-background px-4 py-2 text-sm">
          Hover me
        </button>
      </BaseTooltip>`
  })
}

export const Disabled: Story = {
  args: {
    text: 'This tooltip is disabled',
    disabled: true
  },
  render: (args) => ({
    components: { BaseTooltip },
    setup: () => ({ args }),
    template: `
      <BaseTooltip v-bind="args">
        <button class="rounded-lg bg-secondary-background px-4 py-2 text-sm">
          Hover me (disabled tooltip)
        </button>
      </BaseTooltip>`
  })
}

export const AllSides: Story = {
  render: () => ({
    components: { BaseTooltip },
    template: `
      <div class="grid grid-cols-2 gap-12">
        ${sides
          .map(
            (side) => `
          <BaseTooltip text="${side} tooltip" side="${side}" size="small">
            <button class="w-full rounded-lg bg-secondary-background px-4 py-2 text-sm">
              ${side}
            </button>
          </BaseTooltip>`
          )
          .join('\n')}
      </div>`
  })
}

export const AllVariants: Story = {
  render: () => ({
    components: { BaseTooltip },
    template: `
      <div class="flex flex-col gap-12">
        <div class="flex flex-wrap items-center gap-8">
          <BaseTooltip text="Small tooltip" size="small" side="bottom">
            <button class="rounded-lg bg-secondary-background px-4 py-2 text-sm">Small</button>
          </BaseTooltip>
          <BaseTooltip text="This is a large tooltip with longer text that wraps across multiple lines." size="large" side="bottom">
            <button class="rounded-lg bg-secondary-background px-4 py-2 text-sm">Large</button>
          </BaseTooltip>
          <BaseTooltip text="Undo" keybind="Ctrl+Z" size="small" side="bottom">
            <button class="rounded-lg bg-secondary-background px-4 py-2 text-sm">With Keybind</button>
          </BaseTooltip>
          <BaseTooltip text="More options" :show-icon="true" size="small" side="bottom">
            <button class="rounded-lg bg-secondary-background px-4 py-2 text-sm">With Icon</button>
          </BaseTooltip>
          <BaseTooltip text="Save" keybind="Ctrl+S" :show-icon="true" size="small" side="bottom">
            <button class="rounded-lg bg-secondary-background px-4 py-2 text-sm">All Features</button>
          </BaseTooltip>
        </div>
      </div>`
  })
}
