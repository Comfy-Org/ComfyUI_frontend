// Template: a "create X" dialog form -- Button trigger, Dialog family, Input +
// SingleSelect + Switch fields, Cancel/Save footer. Follows the dialog-form
// shape in .claude/skills/design-system/reference/patterns/forms.md, matching
// real dialogs like SecretFormDialog.vue. Real components throughout.
//
// Extend this one, or copy the file as a starting point for a different
// "create/edit X" dialog.

import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Input from '@/components/ui/input/Input.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import Switch from '@/components/ui/switch/Switch.vue'

const meta: Meta = {
  title: 'Templates/Create Resource Dialog',
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
      DialogClose,
      Input,
      SingleSelect,
      Switch
    },
    setup() {
      const open = ref(false)
      const name = ref('')
      const provider = ref('openai')
      const notify = ref(true)
      const providers = [
        { name: 'OpenAI', value: 'openai' },
        { name: 'Anthropic', value: 'anthropic' },
        { name: 'Google', value: 'google' }
      ]
      return { open, name, provider, notify, providers }
    },
    template: `
      <div class="p-6">
        <Button variant="primary" @click="open = true">New API key</Button>
        <Dialog v-model:open="open">
          <DialogPortal>
            <DialogOverlay />
            <DialogContent size="md">
              <DialogHeader>
                <DialogTitle>Add API key</DialogTitle>
                <DialogClose />
              </DialogHeader>
              <form class="flex flex-col gap-4 px-4 py-2">
                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium">Name</label>
                  <Input v-model="name" placeholder="e.g. Production key" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium">Provider</label>
                  <SingleSelect v-model="provider" :options="providers" />
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">Notify on use</span>
                  <Switch v-model="notify" />
                </div>
              </form>
              <DialogFooter>
                <Button variant="textonly" @click="open = false">Cancel</Button>
                <Button variant="primary" @click="open = false">Save</Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      </div>
    `
  })
}
