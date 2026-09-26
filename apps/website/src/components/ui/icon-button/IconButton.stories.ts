import { Menu, X } from '@lucide/vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'

import IconButton from './IconButton.vue'

const meta: Meta<typeof IconButton> = {
  title: 'Website/UI/IconButton',
  component: IconButton,
  tags: ['autodocs', 'stable'],
  render: (args) => ({
    components: { IconButton, Menu },
    setup: () => ({ args }),
    template:
      '<IconButton v-bind="args" aria-label="Open menu"><Menu class="size-5" /></IconButton>'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Ghost: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Open menu'
    })
    button.focus()
    await expect(button).toHaveFocus()
  }
}
export const Outline: Story = { args: { variant: 'outline' } }
export const Solid: Story = { args: { variant: 'solid' } }
export const LargeClose: Story = {
  args: { size: 'lg' },
  render: (args) => ({
    components: { IconButton, X },
    setup: () => ({ args }),
    template:
      '<IconButton v-bind="args" aria-label="Close"><X class="size-6" /></IconButton>'
  })
}
export const Disabled: Story = { args: { disabled: true } }
