import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'
import { useSnackbarToast } from '@/composables/useSnackbarToast'

import SnackbarToast from './SnackbarToast.vue'

const meta: Meta<typeof SnackbarToast> = {
  title: 'Components/Toast/SnackbarToast',
  component: SnackbarToast,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    () => ({
      template:
        '<div class="relative h-screen bg-base-background p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { SnackbarToast, Button },
    setup() {
      const toast = useSnackbarToast()
      function trigger() {
        toast.show('Toast message')
      }
      return { trigger }
    },
    template: `
      <div class="flex flex-col gap-2">
        <p class="text-base-foreground">Auto-dismiss after 2s. Hover to pause.</p>
        <Button class="w-fit" @click="trigger">Show toast</Button>
        <SnackbarToast />
      </div>
    `
  })
}

export const WithShortcut: Story = {
  render: () => ({
    components: { SnackbarToast, Button },
    setup() {
      const toast = useSnackbarToast()
      function trigger() {
        toast.show('Links hidden', { shortcut: 'Ctrl+A' })
      }
      return { trigger }
    },
    template: `
      <div class="flex flex-col gap-2">
        <p class="text-base-foreground">Toast with assigned keybinding badge.</p>
        <Button class="w-fit" @click="trigger">Show toast</Button>
        <SnackbarToast />
      </div>
    `
  })
}

export const WithUndoAction: Story = {
  render: () => ({
    components: { SnackbarToast, Button },
    setup() {
      const toast = useSnackbarToast()
      function trigger() {
        toast.show('Subgraph unpacked', {
          actionLabel: 'Undo',
          onAction: () => {
            toast.show('Subgraph repacked')
          }
        })
      }
      return { trigger }
    },
    template: `
      <div class="flex flex-col gap-2">
        <p class="text-base-foreground">No assigned shortcut: shows an Undo action button.</p>
        <Button class="w-fit" @click="trigger">Show toast</Button>
        <SnackbarToast />
      </div>
    `
  })
}

export const Persistent: Story = {
  render: () => ({
    components: { SnackbarToast, Button },
    setup() {
      const toast = useSnackbarToast()
      function trigger() {
        toast.show('Stays open until dismissed', { duration: 60_000 })
      }
      return { trigger, dismiss: toast.dismiss }
    },
    template: `
      <div class="flex flex-col gap-2">
        <p class="text-base-foreground">Long duration so close-button behavior is testable.</p>
        <div class="flex gap-2">
          <Button class="w-fit" @click="trigger">Show toast</Button>
          <Button class="w-fit" variant="muted-textonly" @click="dismiss">Dismiss</Button>
        </div>
        <SnackbarToast />
      </div>
    `
  })
}
