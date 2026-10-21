import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import Button from '@/components/ui/button/Button.vue'

import AppDialogPanel from './AppDialogPanel.vue'

const meta: Meta<typeof AppDialogPanel> = {
  title: 'Components/Dialog/AppDialogPanel',
  component: AppDialogPanel,
  tags: ['autodocs'],
  args: { size: 'default', unpadded: false, onClose: fn() },
  argTypes: { size: { control: 'select', options: ['compact', 'default'] } },
  render: (args) => ({
    components: { AppDialogPanel, Button },
    setup: () => ({ args }),
    template: `
      <AppDialogPanel v-bind="args">
        <template #title>Leave workspace</template>
        <p class="m-0 text-sm text-muted-foreground">
          You will lose access to this workspace's workflows and credits.
        </p>
        <template #footer>
          <Button variant="muted-textonly">Cancel</Button>
          <Button variant="destructive" size="lg">Leave</Button>
        </template>
      </AppDialogPanel>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const AllSizes: Story = {
  render: (args) => ({
    components: { AppDialogPanel, Button },
    setup: () => ({ args }),
    template: `
      <div class="flex flex-col gap-6">
        <AppDialogPanel v-for="size in ['default', 'compact']" :key="size" v-bind="args" :size="size">
          <template #title>Leave workspace</template>
          <p class="m-0 text-sm text-muted-foreground">
            You will lose access to this workspace's workflows and credits.
          </p>
          <template #footer>
            <Button variant="muted-textonly">Cancel</Button>
            <Button variant="destructive" size="lg">Leave</Button>
          </template>
        </AppDialogPanel>
      </div>
    `
  })
}

export const CustomBody: Story = {
  args: { unpadded: true, class: 'max-w-2xl' },
  render: (args) => ({
    components: { AppDialogPanel },
    setup: () => ({ args }),
    template: `
      <AppDialogPanel v-bind="args">
        <template #title>Workspace settings</template>
        <div class="grid grid-cols-2 divide-x divide-border">
          <div class="p-6">Members</div>
          <div class="p-6">Access and permissions</div>
        </div>
      </AppDialogPanel>
    `
  })
}
