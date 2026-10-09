import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'

import Toaster from './Toaster.vue'
import { useToast } from './toastStore'

const meta: Meta<typeof Toaster> = {
  title: 'Components/Toast/Toaster',
  component: Toaster,
  parameters: { layout: 'fullscreen' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Kinds: Story = {
  render: () => ({
    components: { Button, Toaster },
    setup() {
      const toast = useToast()
      toast.dismissAll()
      toast.success('Workflow saved')
      toast.info('Update available', { description: 'Restart to apply.' })
      toast.loading('Uploading model.safetensors')
      toast.warning('Pop-up blocked', {
        action: { label: 'Try again', onClick: () => {} },
        description: 'Allow pop-ups for this site and try again.'
      })
      toast.error('Save failed', {
        description: 'ENOSPC: no space left on device, /home/user/workflows'
      })
      return { toast }
    },
    template: `
      <div class="flex h-screen items-start gap-2 bg-base-background p-8">
        <Button @click="toast.info('Saved', { duration: 3000 })">Timed info</Button>
        <Button variant="destructive" @click="toast.dismissAll()">Dismiss all</Button>
        <Toaster />
      </div>
    `
  })
}
