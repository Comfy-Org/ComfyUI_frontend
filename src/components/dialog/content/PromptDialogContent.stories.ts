import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PromptDialogContent from '@/components/dialog/content/PromptDialogContent.vue'

/**
 * `PromptDialogContent` is the body of every dialog opened through
 * `dialogService.prompt()` (e.g. Rename, Export filename). Like
 * `ConfirmationDialogContent` it renders the full standardized modal and is
 * mounted with `headless: true`; stories wrap it in the same box supplied by
 * `CONFIRMATION_DIALOG_CONTENT_CLASS` so the preview matches the app.
 */
const meta: Meta<typeof PromptDialogContent> = {
  title: 'Dialog/PromptDialogContent',
  component: PromptDialogContent,
  render: (args) => ({
    components: { PromptDialogContent },
    setup() {
      return { args }
    },
    template: `
      <div class="flex flex-col overflow-hidden rounded-2xl border border-border-default bg-base-background shadow-lg sm:max-w-[360px]">
        <PromptDialogContent v-bind="args" />
      </div>
    `
  })
}

export default meta
type Story = StoryObj<typeof PromptDialogContent>

export const Rename: Story = {
  args: {
    title: 'Rename',
    message: 'Enter the filename:',
    defaultValue: 'Unsaved Workflow',
    onConfirm: () => {}
  }
}

export const ExportWorkflow: Story = {
  args: {
    title: 'Export workflow',
    message: 'Enter the filename:',
    defaultValue: 'workflow.json',
    onConfirm: () => {}
  }
}

export const WithPlaceholder: Story = {
  args: {
    title: 'Save blueprint',
    message: 'Blueprint name:',
    defaultValue: '',
    placeholder: 'My blueprint',
    onConfirm: () => {}
  }
}
