import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import { onRekaPointerDownOutside } from '@/components/dialog/dialogDismissGuards'
import Button from './button/Button.vue'
import Dialog from './dialog/Dialog.vue'
import DialogContent from './dialog/DialogContent.vue'
import DialogOverlay from './dialog/DialogOverlay.vue'
import DialogPortal from './dialog/DialogPortal.vue'
import DialogTitle from './dialog/DialogTitle.vue'
import Menu from './menu/Menu.vue'
import Popover from './Popover.vue'
import SingleSelect from './single-select/SingleSelect.vue'
import ToastDock from './toast/ToastDock.vue'

const meta: Meta = {
  title: 'Components/Dialog/Overlay ordering',
  tags: ['autodocs'],
  args: { retained: false },
  render: (args) => ({
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
        args,
        a: ref(false),
        b: ref(false),
        selected: ref('a'),
        onRekaPointerDownOutside,
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
      <Dialog v-model:open="a" :unmount-on-hide="!args.retained">
        <DialogPortal>
          <DialogOverlay data-testid="scrim-a" />
          <DialogContent data-testid="dialog-a" class="gap-4 p-6" @pointer-down-outside="onRekaPointerDownOutside({}, $event)">
            <DialogTitle>Dialog A</DialogTitle>
            <input aria-label="Retained text" class="rounded border p-2" placeholder="Retained text" />
            <SingleSelect v-model="selected" label="Choose a value" :options />
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
          <DialogContent data-testid="dialog-b" class="gap-4 p-6" @pointer-down-outside="onRekaPointerDownOutside({}, $event)">
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
