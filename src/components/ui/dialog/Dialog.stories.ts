import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@comfyorg/design-system/dialog/Dialog'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogDescription from '@comfyorg/design-system/dialog/DialogDescription'
import DialogFooter from '@comfyorg/design-system/dialog/DialogFooter'
import DialogHeader from '@comfyorg/design-system/dialog/DialogHeader'
import DialogOverlay from '@comfyorg/design-system/dialog/DialogOverlay'
import DialogPortal from '@comfyorg/design-system/dialog/DialogPortal'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import type {
  DialogContentSize,
  DialogContentSurface
} from '@comfyorg/design-system/lib/dialog/dialog.variants'

const sizes = [
  'sm',
  'md',
  'lg',
  'xl',
  'full',
  'fit'
] satisfies DialogContentSize[]
const surfaces = ['card', 'none'] satisfies DialogContentSurface[]

const meta: Meta = {
  title: 'Components/Dialog/Dialog',
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: sizes,
      defaultValue: 'md'
    },
    surface: {
      control: { type: 'select' },
      options: surfaces,
      defaultValue: 'card'
    }
  },
  args: {
    size: 'md',
    surface: 'card'
  }
}

export default meta
type Story = StoryObj

export const Default: Story = {
  render: (args) => ({
    components: {
      Button,
      Dialog,
      DialogPortal,
      DialogOverlay,
      DialogContent,
      DialogHeader,
      DialogFooter,
      DialogTitle,
      DialogDescription,
      DialogClose
    },
    setup() {
      const open = ref(false)
      return { args, open }
    },
    template: `
      <Button @click="open = true">Open dialog</Button>
      <Dialog v-model:open="open">
        <DialogPortal>
          <DialogOverlay />
          <DialogContent :size="args.size" :surface="args.surface">
            <DialogHeader>
              <DialogTitle>Are you sure?</DialogTitle>
              <DialogClose />
            </DialogHeader>
            <div class="px-4 py-2">
              <DialogDescription>
                This action cannot be undone. The selected items will be permanently removed.
              </DialogDescription>
            </div>
            <DialogFooter>
              <Button variant="textonly" @click="open = false">Cancel</Button>
              <Button variant="destructive" @click="open = false">Delete</Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    `
  })
}

export const LongContent: Story = {
  render: (args) => ({
    components: {
      Button,
      Dialog,
      DialogPortal,
      DialogOverlay,
      DialogContent,
      DialogHeader,
      DialogTitle,
      DialogClose
    },
    setup() {
      const open = ref(false)
      return { args, open }
    },
    template: `
      <Button @click="open = true">Open long content</Button>
      <Dialog v-model:open="open">
        <DialogPortal>
          <DialogOverlay />
          <DialogContent :size="args.size" :surface="args.surface">
            <DialogHeader>
              <DialogTitle>Long content scrolls</DialogTitle>
              <DialogClose />
            </DialogHeader>
            <div class="px-4 py-2 space-y-2 overflow-auto">
              <p v-for="n in 30" :key="n">
                Paragraph {{ n }} — the dialog body should scroll independently
                while the header and footer stay pinned.
              </p>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    `
  })
}

export const Headless: Story = {
  render: () => ({
    components: {
      Button,
      Dialog,
      DialogPortal,
      DialogOverlay,
      DialogContent
    },
    setup() {
      const open = ref(false)
      return { open }
    },
    template: `
      <Button @click="open = true">Open headless</Button>
      <Dialog v-model:open="open">
        <DialogPortal>
          <DialogOverlay />
          <DialogContent size="sm" class="p-6">
            <p class="text-sm">No header, no footer — fully custom content.</p>
            <Button class="mt-4" @click="open = false">Close</Button>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    `
  })
}

export const AllSizes: Story = {
  render: () => ({
    components: {
      Button,
      Dialog,
      DialogPortal,
      DialogOverlay,
      DialogContent,
      DialogHeader,
      DialogTitle,
      DialogClose
    },
    setup() {
      const openSize = ref<string | null>(null)
      return { openSize, sizes }
    },
    template: `
      <div class="flex gap-2 flex-wrap">
        <Button v-for="s in sizes" :key="s" @click="openSize = s">{{ s }}</Button>
      </div>
      <Dialog
        v-for="s in sizes"
        :key="s"
        :open="openSize === s"
        @update:open="(o) => { if (!o) openSize = null }"
      >
        <DialogPortal>
          <DialogOverlay />
          <DialogContent :size="s">
            <DialogHeader>
              <DialogTitle>Size: {{ s }}</DialogTitle>
              <DialogClose />
            </DialogHeader>
            <div class="px-4 py-2 text-sm">
              The {{ s }} size variant.
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    `
  })
}
