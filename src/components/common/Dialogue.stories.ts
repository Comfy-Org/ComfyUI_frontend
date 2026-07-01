import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'

import Dialogue from './Dialogue.vue'

const meta = {
  title: 'Components/Dialogue',
  component: Dialogue,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof Dialogue>

export default meta
type Story = StoryObj<typeof meta>

export const WithTitle: Story = {
  render: (args) => ({
    components: { Dialogue, Button },
    setup: () => ({ args }),
    template: `
      <Dialogue v-bind="args">
        <template #button>
          <Button>Open dialog</Button>
        </template>
        <template #default="{ close }">
          <div class="flex flex-col gap-6 p-4">
            <p class="text-sm text-muted-foreground">
              A more descriptive lorem ipsum text...
            </p>
            <div class="flex items-center justify-end gap-4">
              <Button variant="muted-textonly" size="sm" @click="close">
                Cancel
              </Button>
              <Button variant="secondary" size="lg" @click="close">
                Ok
              </Button>
            </div>
          </div>
        </template>
      </Dialogue>
    `
  }),
  args: {
    title: 'Modal Title'
  }
}

export const WithoutTitle: Story = {
  render: () => ({
    components: { Dialogue, Button },
    template: `
      <Dialogue>
        <template #button>
          <Button>Open dialog</Button>
        </template>
        <template #default="{ close }">
          <div class="flex flex-col gap-4 p-4">
            <p class="text-sm text-muted-foreground">
              This dialog has no title header.
            </p>
            <div class="flex justify-end">
              <Button variant="secondary" size="lg" @click="close">
                Got it
              </Button>
            </div>
          </div>
        </template>
      </Dialogue>
    `
  })
}

export const Confirmation: Story = {
  render: () => ({
    components: { Dialogue, Button },
    template: `
      <Dialogue title="Delete this item?">
        <template #button>
          <Button variant="destructive">Delete</Button>
        </template>
        <template #default="{ close }">
          <div class="flex flex-col gap-6 p-4">
            <p class="text-sm text-muted-foreground">
              This action cannot be undone. The item will be permanently removed.
            </p>
            <div class="flex items-center justify-end gap-4">
              <Button variant="muted-textonly" size="sm" @click="close">
                Cancel
              </Button>
              <Button variant="destructive" size="lg" @click="close">
                Delete
              </Button>
            </div>
          </div>
        </template>
      </Dialogue>
    `
  })
}

export const WithLink: Story = {
  render: () => ({
    components: { Dialogue, Button },
    template: `
      <Dialogue title="Modal Title">
        <template #button>
          <Button>Open dialog</Button>
        </template>
        <template #default="{ close }">
          <div class="flex flex-col gap-6 p-4">
            <p class="text-sm text-muted-foreground">
              A more descriptive lorem ipsum text...
            </p>
            <div class="flex items-center justify-between">
              <button class="flex items-center gap-2 text-sm text-muted-foreground hover:text-base-foreground">
                <i class="icon-[lucide--external-link] size-4" />
                See what's new
              </button>
              <div class="flex items-center gap-4">
                <Button variant="muted-textonly" size="sm" @click="close">
                  Cancel
                </Button>
                <Button variant="secondary" size="lg" @click="close">
                  Ok
                </Button>
              </div>
            </div>
          </div>
        </template>
      </Dialogue>
    `
  })
}
