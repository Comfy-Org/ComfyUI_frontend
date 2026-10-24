import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { DropdownMenuRadioGroup } from 'reka-ui'

import Menu from '@/components/ui/menu/Menu.vue'
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

/**
 * One row of the deployment switcher, with its workflow compatibility mark.
 * A row is a radio item, so each story renders it inside an open menu.
 */
const meta: Meta<typeof DeploymentSwitcherRow> = {
  title: 'Components/DeploymentSwitcher/Row',
  component: DeploymentSwitcherRow,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    value: 'dep-f24d36bb',
    title: 'Studio production',
    subtitle: 'v2',
    tone: 'ready',
    meta: null,
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
    (story, { args, parameters }) => ({
      components: { story, Menu, DropdownMenuRadioGroup },
      setup: () => ({ checked: parameters.checked ? args.value : undefined }),
      template: `
        <Menu :open="true" :modal="false" class="max-w-100 min-w-56">
          <template #trigger><button type="button">Run on</button></template>
          <DropdownMenuRadioGroup :model-value="checked"><story /></DropdownMenuRadioGroup>
        </Menu>`
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
    setup: () => ({ args, marks: Object.entries(marks) }),
    template:
      '<DeploymentSwitcherRow v-for="[key, mark] in marks" :key="key" v-bind="args" :value="key" :mark="mark" />'
  })
}

/** The row this browser runs on, marked as able to run the workflow. */
export const CheckedAndRuns: Story = {
  args: { mark: marks.runs },
  parameters: { checked: true }
}
