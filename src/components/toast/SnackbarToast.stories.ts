import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'
import { useSnackbarToast } from '@/composables/useSnackbarToast'

import SnackbarToastProvider from './SnackbarToastProvider.vue'

const meta: Meta<typeof SnackbarToastProvider> = {
  title: 'Components/Toast/SnackbarToast',
  component: SnackbarToastProvider,
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
    components: { SnackbarToastProvider, Button, Trigger },
    template: `
      <SnackbarToastProvider>
        <Trigger label="Show toast" message="Toast message" />
      </SnackbarToastProvider>
    `
  })
}

export const WithShortcut: Story = {
  render: () => ({
    components: { SnackbarToastProvider, Button, TriggerWithShortcut },
    template: `
      <SnackbarToastProvider>
        <TriggerWithShortcut />
      </SnackbarToastProvider>
    `
  })
}

export const WithUndoAction: Story = {
  render: () => ({
    components: { SnackbarToastProvider, Button, TriggerWithUndo },
    template: `
      <SnackbarToastProvider>
        <TriggerWithUndo />
      </SnackbarToastProvider>
    `
  })
}

export const Persistent: Story = {
  render: () => ({
    components: { SnackbarToastProvider, Button, TriggerPersistent },
    template: `
      <SnackbarToastProvider>
        <TriggerPersistent />
      </SnackbarToastProvider>
    `
  })
}

const Trigger = {
  components: { Button },
  setup() {
    const toast = useSnackbarToast()
    return { trigger: () => toast.show('Toast message') }
  },
  template: `<Button class="w-fit" @click="trigger">Show toast</Button>`
}

const TriggerWithShortcut = {
  components: { Button },
  setup() {
    const toast = useSnackbarToast()
    return {
      trigger: () => toast.show('Links hidden', { shortcut: 'Ctrl+A' })
    }
  },
  template: `<Button class="w-fit" @click="trigger">Show toast</Button>`
}

const TriggerWithUndo = {
  components: { Button },
  setup() {
    const toast = useSnackbarToast()
    return {
      trigger: () =>
        toast.show('Subgraph unpacked', {
          actionLabel: 'Undo',
          onAction: () => toast.show('Subgraph repacked')
        })
    }
  },
  template: `<Button class="w-fit" @click="trigger">Show toast</Button>`
}

const TriggerPersistent = {
  components: { Button },
  setup() {
    const toast = useSnackbarToast()
    return {
      trigger: () =>
        toast.show('Stays open until dismissed', { duration: 60_000 })
    }
  },
  template: `<Button class="w-fit" @click="trigger">Show toast</Button>`
}
