import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import CopyTextButton from './CopyTextButton.vue'

const meta: Meta<typeof CopyTextButton> = {
  title: 'Website/UI/CopyTextButton',
  component: CopyTextButton,
  tags: ['autodocs', 'stable'],
  args: {
    value: 'pnpm add @comfyorg/ui',
    label: 'Copy command',
    copiedLabel: 'Command copied'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await expect(
      canvas.getByRole('button', { name: 'Copy command' })
    ).toHaveFocus()
  }
}
