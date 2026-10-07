import type { Meta, StoryObj } from '@storybook/vue3-vite'

import DeploymentSwitcherRow from './DeploymentSwitcherRow.vue'

/**
 * One row of the deployment switcher's list. With a workflow open, a row says
 * whether its deployment can run it: it runs it, it is missing nodes (named on
 * hover), or ingest could not check it because its Release has no node list.
 */
const meta: Meta<typeof DeploymentSwitcherRow> = {
  title: 'Components/DeploymentSwitcher/Row',
  component: DeploymentSwitcherRow,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    label: 'Studio Build v2',
    caption: 'dep-f24d36bb, ready',
    checked: false
  },
  decorators: [
    () => ({
      template:
        '<div class="w-80 rounded-lg border border-border-default bg-base-background"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

/** No workflow open, or the check failed: the row says nothing more. */
export const Default: Story = {}

export const RunsThisWorkflow: Story = {
  args: { mark: { kind: 'runs' } }
}

/** Hover the mark to see the missing node types. */
export const MissingNodes: Story = {
  args: {
    mark: {
      kind: 'missing',
      nodeTypes: ['Power Lora Loader (rgthree)', 'Image Saver']
    }
  }
}

/** The deployment's Release has no node list (not built yet, or gone). */
export const NotChecked: Story = {
  args: { mark: { kind: 'unknown' } }
}

/** The row this browser runs on, marked as able to run the workflow. */
export const CheckedAndRuns: Story = {
  args: { checked: true, mark: { kind: 'runs' } }
}
