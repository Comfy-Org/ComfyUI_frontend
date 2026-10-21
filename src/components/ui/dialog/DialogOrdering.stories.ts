import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import Popover from '@/components/ui/Popover.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import ToastDock from '@/components/ui/toast/ToastDock.vue'

const meta: Meta = {
  title: 'Components/Dialog/Overlay ordering',
  tags: ['autodocs'],
  render: () => ({
    components: {
      Button,
      Dialog,
      DialogContent,
      DialogOverlay,
      DialogPortal,
      DialogTitle,
      Menu,
      Popover,
      SingleSelect,
      ToastDock
    },
    setup() {
      return {
        a: ref(false),
        b: ref(false),
        selected: ref('a'),
        options: [
          { name: 'Alpha', value: 'a' },
          { name: 'Beta', value: 'b' }
        ],
        items: [{ label: 'Actions', items: [{ label: 'Nested action' }] }]
      }
    },
    template: `
      <div class="flex gap-4 p-8">
        <Button @click="a = true">Open A</Button>
        <Button @click="b = true">Open B</Button>
      </div>
      <Dialog v-model:open="a">
        <DialogPortal>
          <DialogOverlay data-testid="scrim-a" />
          <DialogContent data-testid="dialog-a" class="gap-4 p-6" @pointer-down-outside.prevent>
            <DialogTitle>Dialog A</DialogTitle>
            <input aria-label="Dialog input" class="rounded border p-2" placeholder="Dialog input" />
            <SingleSelect v-model="selected" label="Choose a value" accessible-label="Choose a value" :options />
            <Menu :items><template #trigger><Button>Open menu</Button></template></Menu>
            <Popover><template #button><Button>Open popover</Button></template><Button>Popover action</Button></Popover>
            <div class="flex gap-2">
              <Button @click="b = true">Open B above A</Button>
              <Button @click="a = false">Close A</Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
      <Dialog v-model:open="b">
        <DialogPortal>
          <DialogOverlay data-testid="scrim-b" />
          <DialogContent data-testid="dialog-b" class="gap-4 p-6" @pointer-down-outside.prevent>
            <DialogTitle>Dialog B</DialogTitle>
            <Button @click="a = true">Reopen A above B</Button>
            <Button @click="b = false">Close B</Button>
          </DialogContent>
        </DialogPortal>
      </Dialog>
      <ToastDock>
        <div class="flex items-center gap-4 rounded-lg border bg-background p-4 shadow-lg">
          <span>Upload complete</span>
          <Popover>
            <template #button><Button>Toast details</Button></template>
            <Button>Toast popover action</Button>
          </Popover>
        </div>
      </ToastDock>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
