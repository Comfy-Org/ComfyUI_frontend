import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import type { ConfirmationDialogType } from '@/services/dialogService'

/**
 * `ConfirmationDialogContent` is the body of every dialog opened through
 * `dialogService.confirm()`. It renders the full standardized modal — header,
 * body and footer — and is mounted with `headless: true` so the surrounding
 * `DialogContent` only supplies the rounded box (see
 * `CONFIRMATION_DIALOG_CONTENT_CLASS`). Stories wrap it in that same box so the
 * preview matches what users see.
 */
const meta: Meta<typeof ConfirmationDialogContent> = {
  title: 'Dialog/ConfirmationDialogContent',
  component: ConfirmationDialogContent,
  argTypes: {
    type: {
      control: { type: 'select' },
      options: [
        'default',
        'delete',
        'overwrite',
        'overwriteBlueprint',
        'dirtyClose',
        'reinstall',
        'info'
      ] satisfies ConfirmationDialogType[]
    }
  },
  render: (args) => ({
    components: { ConfirmationDialogContent },
    setup() {
      return { args }
    },
    template: `
      <div class="flex flex-col overflow-hidden rounded-2xl border border-border-default bg-base-background shadow-lg sm:max-w-[360px]">
        <ConfirmationDialogContent v-bind="args" />
      </div>
    `
  })
}

export default meta
type Story = StoryObj<typeof ConfirmationDialogContent>

export const Default: Story = {
  args: {
    title: 'Save changes?',
    message: 'Do you want to apply these changes to the current workflow?',
    type: 'default',
    onConfirm: () => {}
  }
}

export const Delete: Story = {
  args: {
    title: 'Delete workflow?',
    message: 'This will permanently delete the following workflow:',
    type: 'delete',
    itemList: ['my-awesome-workflow.json'],
    onConfirm: () => {}
  }
}

export const Overwrite: Story = {
  args: {
    title: 'Overwrite existing file?',
    message: 'A file with this name already exists. Overwrite it?',
    type: 'overwrite',
    onConfirm: () => {}
  }
}

export const DirtyClose: Story = {
  args: {
    title: 'Unsaved changes',
    message: 'You have unsaved changes. Save them before closing?',
    type: 'dirtyClose',
    denyLabel: 'Close anyway',
    onConfirm: () => {}
  }
}

export const WithHint: Story = {
  args: {
    title: 'Reset settings?',
    message: 'This restores all settings to their defaults.',
    type: 'default',
    hint: 'This action cannot be undone.',
    onConfirm: () => {}
  }
}

export const Info: Story = {
  args: {
    title: 'Coming soon',
    message: 'Billing management will be available in a future update.',
    type: 'info',
    onConfirm: () => {}
  }
}
