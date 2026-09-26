import type { Meta, StoryObj } from '@storybook/vue3-vite'

import TypeformPopoverButton from './TypeformPopoverButton.vue'

const meta = {
  title: 'Components/TypeformPopoverButton',
  component: TypeformPopoverButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof TypeformPopoverButton>

export default meta
type Story = StoryObj<typeof meta>

/** Default: help button that opens an embedded Typeform survey. */
export const Default: Story = {
  args: {
    dataTfWidget: 'example123',
    active: true
  }
}

/** Inactive: popover content is hidden. */
export const Inactive: Story = {
  args: {
    dataTfWidget: 'example123',
    active: false
  }
}
