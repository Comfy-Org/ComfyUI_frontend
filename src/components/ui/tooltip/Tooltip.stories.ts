import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'

import Tooltip from './Tooltip.vue'

const meta = {
  title: 'UI/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right']
    }
  }
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { Tooltip, Button },
    setup: () => ({ args }),
    template: `
      <Tooltip v-bind="args">
        <Button>Hover me</Button>
      </Tooltip>
    `
  }),
  args: {
    text: 'This is a tooltip',
    side: 'top'
  }
}

export const AllSides: Story = {
  render: () => ({
    components: { Tooltip, Button },
    template: `
      <div class="flex flex-col items-center gap-12 p-20">
        <Tooltip text="Top tooltip" side="top">
          <Button>Top</Button>
        </Tooltip>
        <div class="flex gap-12">
          <Tooltip text="Left tooltip" side="left">
            <Button>Left</Button>
          </Tooltip>
          <Tooltip text="Right tooltip" side="right">
            <Button>Right</Button>
          </Tooltip>
        </div>
        <Tooltip text="Bottom tooltip" side="bottom">
          <Button>Bottom</Button>
        </Tooltip>
      </div>
    `
  })
}

export const LongText: Story = {
  render: () => ({
    components: { Tooltip, Button },
    template: `
      <Tooltip text="The random seed used for creating the noise. This controls the reproducibility of generated images." side="top">
        <Button>Hover for details</Button>
      </Tooltip>
    `
  })
}

export const Disabled: Story = {
  render: () => ({
    components: { Tooltip, Button },
    template: `
      <Tooltip text="You won't see this" :disabled="true">
        <Button>No tooltip</Button>
      </Tooltip>
    `
  })
}
