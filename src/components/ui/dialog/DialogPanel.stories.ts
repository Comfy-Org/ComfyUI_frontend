import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import Button from '@/components/ui/button/Button.vue'
import DialogPanel from '@/components/ui/dialog/DialogPanel.vue'

const meta: Meta<typeof DialogPanel> = {
  title: 'Components/Dialog/DialogPanel',
  component: DialogPanel,
  tags: ['autodocs'],
  args: { onClose: fn(), closeLabel: 'Close' },
  render: (args) => ({
    components: { Button, DialogPanel },
    setup: () => ({ args }),
    template: `
      <DialogPanel v-bind="args" class="w-full max-w-[360px]">
        <template #title>Leave workspace</template>
        <p class="m-0 p-4 text-sm text-muted-foreground">
          You will lose access to this workspace's workflows and credits.
        </p>
        <template #footer>
          <Button variant="muted-textonly">Cancel</Button>
          <Button variant="destructive" size="lg">Leave</Button>
        </template>
      </DialogPanel>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
