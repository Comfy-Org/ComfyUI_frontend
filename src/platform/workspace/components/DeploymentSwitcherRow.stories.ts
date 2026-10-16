import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'

import DeploymentSwitcherRow from './DeploymentSwitcherRow.vue'

const marks = {
  none: null,
  runs: { kind: 'runs' },
  missing: {
    kind: 'missing',
    nodeTypes: ['Power Lora Loader (rgthree)', 'Image Saver']
  },
  unknown: { kind: 'unknown' }
} satisfies Record<string, DeploymentCompatibilityMark | null>

/** One row of the deployment switcher, with its workflow compatibility mark. */
const meta: Meta<typeof DeploymentSwitcherRow> = {
  title: 'Components/DeploymentSwitcher/Row',
  component: DeploymentSwitcherRow,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    label: 'Studio Build v2',
    caption: 'dep-f24d36bb, ready',
    checked: false,
    mark: null
  },
  argTypes: {
    mark: {
      control: 'select',
      options: Object.keys(marks),
      mapping: marks
    }
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

export const Default: Story = {}

/** Every mark side by side: none, runs, missing nodes, not checked. */
export const AllMarks: Story = {
  render: (args) => ({
    components: { DeploymentSwitcherRow },
    setup: () => ({ args, marks: Object.values(marks) }),
    template:
      '<DeploymentSwitcherRow v-for="(mark, index) in marks" :key="index" v-bind="args" :mark="mark" />'
  })
}

/** The row this browser runs on, marked as able to run the workflow. */
export const CheckedAndRuns: Story = {
  args: { checked: true, mark: marks.runs }
}
