import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { TooltipProvider } from 'reka-ui'

import Button from '@/components/ui/button/Button.vue'
import BaseTooltip from './BaseTooltip.vue'

const meta: Meta<typeof BaseTooltip> = {
  title: 'Components/Tooltip/BaseTooltip',
  component: BaseTooltip,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      components: { TooltipProvider, story },
      template:
        '<TooltipProvider :delay-duration="0"><story /></TooltipProvider>'
    })
  ],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'small', 'large']
    },
    side: {
      control: { type: 'select' },
      options: ['top', 'bottom', 'left', 'right']
    },
    sideOffset: { control: { type: 'number' } },
    disabled: { control: { type: 'boolean' } },
    text: { control: { type: 'text' } }
  },
  args: {
    variant: 'default',
    side: 'top',
    sideOffset: 4,
    disabled: false,
    text: 'Tooltip text'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const SingleTooltip: Story = {
  render: (args) => ({
    components: { BaseTooltip, Button },
    setup() {
      return { args }
    },
    template: `
      <div class="flex items-center justify-center p-20">
        <BaseTooltip v-bind="args">
          <Button variant="secondary">Hover me</Button>
        </BaseTooltip>
      </div>
    `
  })
}

export const AllVariants: Story = {
  render: () => ({
    components: { BaseTooltip, Button },
    template: `
      <div class="flex items-center justify-center gap-8 p-20">
        <BaseTooltip text="Default tooltip" variant="default">
          <Button variant="secondary">Default</Button>
        </BaseTooltip>
        <BaseTooltip text="Small tooltip" variant="small">
          <Button variant="secondary">Small</Button>
        </BaseTooltip>
        <BaseTooltip text="Large tooltip with longer text that demonstrates the max-width constraint of the large variant" variant="large">
          <Button variant="secondary">Large</Button>
        </BaseTooltip>
      </div>
    `
  })
}

export const AllSides: Story = {
  render: () => ({
    components: { BaseTooltip, Button },
    template: `
      <div class="flex items-center justify-center gap-8 p-20">
        <BaseTooltip text="Top tooltip" side="top" variant="small">
          <Button variant="secondary">Top</Button>
        </BaseTooltip>
        <BaseTooltip text="Bottom tooltip" side="bottom" variant="small">
          <Button variant="secondary">Bottom</Button>
        </BaseTooltip>
        <BaseTooltip text="Left tooltip" side="left" variant="small">
          <Button variant="secondary">Left</Button>
        </BaseTooltip>
        <BaseTooltip text="Right tooltip" side="right" variant="small">
          <Button variant="secondary">Right</Button>
        </BaseTooltip>
      </div>
    `
  })
}

export const Disabled: Story = {
  args: {
    text: 'This tooltip is disabled',
    disabled: true
  },
  render: (args) => ({
    components: { BaseTooltip, Button },
    setup() {
      return { args }
    },
    template: `
      <div class="flex items-center justify-center p-20">
        <BaseTooltip v-bind="args">
          <Button variant="secondary">No tooltip (disabled)</Button>
        </BaseTooltip>
      </div>
    `
  })
}

export const LongText: Story = {
  render: () => ({
    components: { BaseTooltip, Button },
    template: `
      <div class="flex items-center justify-center p-20">
        <BaseTooltip
          text="Encodes a text prompt using a CLIP model into an embedding that can be used to guide the diffusion model towards generating specific images."
          variant="large"
        >
          <Button variant="secondary">Hover for long text</Button>
        </BaseTooltip>
      </div>
    `
  })
}
