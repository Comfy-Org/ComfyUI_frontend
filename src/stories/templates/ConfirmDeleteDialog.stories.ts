// Template: destructive-action confirmation dialog, following
// reference/patterns/confirmation-dialogs.md -- Cancel on the left,
// destructive action on the right, both driven by Button.loading during
// the fake async delete (ties in reference/patterns/loading-states.md too).
// Matches the real DeleteWorkspaceDialogContent.vue shape.

import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'

const meta: Meta = {
  title: 'Templates/Confirm Delete Dialog',
  tags: ['autodocs']
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    components: {
      Button,
      Dialog,
      DialogPortal,
      DialogOverlay,
      DialogContent,
      DialogHeader,
      DialogFooter,
      DialogTitle,
      DialogDescription
    },
    setup() {
      const open = ref(false)
      const deleting = ref(false)

      function confirmDelete() {
        deleting.value = true
        setTimeout(() => {
          deleting.value = false
          open.value = false
        }, 1200)
      }

      return { open, deleting, confirmDelete }
    },
    template: `
      <div class="p-6">
        <Button variant="destructive" @click="open = true">Delete workspace</Button>
        <Dialog v-model:open="open">
          <DialogPortal>
            <DialogOverlay />
            <DialogContent size="sm">
              <DialogHeader>
                <DialogTitle>Delete workspace?</DialogTitle>
              </DialogHeader>
              <div class="px-4 py-2">
                <DialogDescription>
                  This will permanently remove &ldquo;Design Team&rdquo; and everything in it. This action cannot be undone.
                </DialogDescription>
              </div>
              <DialogFooter>
                <Button variant="muted-textonly" :disabled="deleting" @click="open = false">Cancel</Button>
                <Button variant="destructive" :loading="deleting" @click="confirmDelete">Delete</Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      </div>
    `
  })
}
