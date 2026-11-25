import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { CONTROL_OPTIONS } from '@/types/simplifiedWidget'

import ValueControlButton from './ValueControlButton.vue'

const meta: Meta<typeof ValueControlButton> = {
  title: 'Components/InputHelpers/ValueControlButton',
  component: ValueControlButton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    mode: { control: 'select', options: [...CONTROL_OPTIONS] }
  },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="flex items-center justify-center rounded-lg bg-node p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Randomize: Story = {
  args: { mode: 'randomize' }
}

export const Fixed: Story = {
  args: { mode: 'fixed' }
}

export const Increment: Story = {
  args: { mode: 'increment' }
}

export const Decrement: Story = {
  args: { mode: 'decrement' }
}

export const AllModes: Story = {
  render: () => ({
    components: { ValueControlButton },
    template: `
      <div class="flex items-center gap-3">
        <ValueControlButton mode="randomize" />
        <ValueControlButton mode="fixed" />
        <ValueControlButton mode="increment" />
        <ValueControlButton mode="decrement" />
      </div>
    `
  })
}
