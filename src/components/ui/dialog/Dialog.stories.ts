import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { FOR_STORIES } from '@/components/ui/dialog/dialog.variants'

const { sizes } = FOR_STORIES

const meta: Meta = {
  title: 'Components/Dialog/Dialog',
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: sizes,
      defaultValue: 'md'
    }
  },
  args: {
    size: 'md'
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
          <DialogContent :size="args.size">
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
          <DialogContent :size="args.size">
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
