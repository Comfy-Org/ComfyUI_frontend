import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import CopyableField from './CopyableField.vue'

const meta: Meta<typeof CopyableField> = {
  title: 'Website/UI/CopyableField',
  component: CopyableField,
  tags: ['autodocs', 'stable'],
  args: {
    value: 'pnpm add @comfyorg/ui',
    copyLabel: 'Copy command',
    copiedLabel: 'Command copied'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const SingleLine: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await expect(
      canvas.getByRole('button', { name: 'Copy command' })
    ).toHaveFocus()
  }
}
export const Multiline: Story = {
  args: { value: 'pnpm install\npnpm dev\npnpm build' }
}
