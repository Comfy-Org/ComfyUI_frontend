import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { DropdownMenuRadioGroup } from 'reka-ui'

import Menu from '@/components/ui/menu/Menu.vue'

import DeploymentSwitcherRow from './DeploymentSwitcherRow.vue'

const meta: Meta<typeof DeploymentSwitcherRow> = {
  title: 'Components/DeploymentSwitcher/Row',
  component: DeploymentSwitcherRow,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    value: 'dep-f24d36bb',
    title: 'Studio Build',
    deployment: 'production',
    detail: 'v2',
    tooltip: 'Studio Build · production · v2',
    tone: 'ready',
    compatibilityNote: null
  },
  decorators: [
    (story, { args, parameters }) => ({
      components: { story, Menu, DropdownMenuRadioGroup },
      setup: () => ({ checked: parameters.checked ? args.value : undefined }),
      template: `
        <Menu :open="true" :modal="false" class="w-84">
          <template #trigger><button type="button">Run on</button></template>
          <DropdownMenuRadioGroup :model-value="checked"><story /></DropdownMenuRadioGroup>
        </Menu>`
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The row this browser runs on. */
export const Checked: Story = {
  parameters: { checked: true }
}

/** A Build name too long for its column; hovering spells it out. */
export const LongBuildName: Story = {
  args: {
    title: 'Wan 2.2 image-to-video with ControlNet depth and face restore',
    tooltip:
      'Wan 2.2 image-to-video with ControlNet depth and face restore · production · v12'
  }
}

/** A deployment that cannot run the open workflow; hovering names the nodes. */
export const MissingNodes: Story = {
  args: {
    compatibilityNote:
      'Studio Build · production cannot run this workflow. It is missing Power Lora Loader (rgthree) and Image Saver.'
  }
}

/** Every status side by side, in the same columns. */
export const Statuses: Story = {
  render: (args) => ({
    components: { DeploymentSwitcherRow },
    setup: () => ({
      args,
      rows: [
        { tone: 'ready', deployment: 'production', detail: 'v2' },
        { tone: 'pending', deployment: 'gpu-a100', detail: 'Starting' },
        { tone: 'stopped', deployment: 'staging', detail: 'Stopped' },
        { tone: 'failed', deployment: 'nightly', detail: 'Failed' }
      ]
    }),
    template:
      '<DeploymentSwitcherRow v-for="row in rows" :key="row.tone" v-bind="{ ...args, ...row }" :value="row.tone" />'
  })
}
