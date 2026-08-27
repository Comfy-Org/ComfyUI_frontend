import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import Button from '../button/Button.vue'
import Dialog from './Dialog.vue'
import DialogContent from './DialogContent.vue'
import DialogDescription from './DialogDescription.vue'
import DialogTitle from './DialogTitle.vue'
import DialogTrigger from './DialogTrigger.vue'

const meta: Meta<typeof Dialog> = {
  title: 'Website/UI/Dialog',
  component: Dialog,
  tags: ['autodocs', 'stable'],
  render: (args) => ({
    components: {
      Button,
      Dialog,
      DialogContent,
      DialogDescription,
      DialogTitle,
      DialogTrigger
    },
    setup: () => ({ args }),
    template: `
      <Dialog v-bind="args">
        <DialogTrigger as-child><Button>View details</Button></DialogTrigger>
        <DialogContent close-label="Close dialog">
          <DialogTitle>Run this workflow</DialogTitle>
          <DialogDescription class="mt-3">Open the workflow in Comfy Cloud or download it for local use.</DialogDescription>
        </DialogContent>
      </Dialog>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'View details' }))
    const body = within(document.body)
    const dialog = body.getByRole('dialog')
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'open'))
    await expect(body.getByText('Run this workflow')).toBeInTheDocument()
    await userEvent.click(body.getByRole('button', { name: 'Close dialog' }))
    await waitFor(() =>
      expect(body.queryByRole('dialog')).not.toBeInTheDocument()
    )
  }
}
