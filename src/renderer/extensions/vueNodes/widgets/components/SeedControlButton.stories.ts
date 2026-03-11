import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { CONTROL_OPTIONS } from '@/types/simplifiedWidget'

import SeedControlButton from './SeedControlButton.vue'

const meta: Meta<typeof SeedControlButton> = {
  title: 'Components/InputHelpers/SeedControlButton',
  component: SeedControlButton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    mode: { control: 'select', options: [...CONTROL_OPTIONS] },
    variant: { control: 'select', options: ['badge', 'button'] }
  },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="flex items-center justify-center rounded-lg bg-node-component-surface p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Randomize: Story = {
  args: { mode: 'randomize', variant: 'badge' }
}

export const Fixed: Story = {
  args: { mode: 'fixed', variant: 'badge' }
}

export const Increment: Story = {
  args: { mode: 'increment', variant: 'badge' }
}

export const Decrement: Story = {
  args: { mode: 'decrement', variant: 'badge' }
}

export const AllModes: Story = {
  render: () => ({
    components: { SeedControlButton },
    template: `
      <div class="flex flex-col gap-6">
        <div>
          <p class="mb-2 text-sm text-muted-foreground">Badge</p>
          <div class="flex items-center gap-3">
            <SeedControlButton mode="randomize" variant="badge" />
            <SeedControlButton mode="fixed" variant="badge" />
            <SeedControlButton mode="increment" variant="badge" />
            <SeedControlButton mode="decrement" variant="badge" />
          </div>
        </div>
        <div>
          <p class="mb-2 text-sm text-muted-foreground">Button</p>
          <div class="flex items-center gap-3">
            <SeedControlButton mode="randomize" variant="button" />
            <SeedControlButton mode="fixed" variant="button" />
            <SeedControlButton mode="increment" variant="button" />
            <SeedControlButton mode="decrement" variant="button" />
          </div>
        </div>
      </div>
    `
  })
}
