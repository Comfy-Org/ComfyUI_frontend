import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'

import Popover from './Popover.vue'

const meta = {
  title: 'Components/Popover',
  component: Popover,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1a1a1b' },
        { name: 'light', value: '#ffffff' },
        { name: 'sidebar', value: '#232326' }
      ]
    }
  }
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

/** Default: menu-style popover with action entries. */
export const Default: Story = {
  render: () => ({
    components: { Popover },
    template: `
      <Popover
        :entries="[
          { label: 'Rename', icon: 'icon-[lucide--pencil]', command: () => {} },
          { label: 'Duplicate', icon: 'icon-[lucide--copy]', command: () => {} },
          { separator: true },
          { label: 'Delete', icon: 'icon-[lucide--trash-2]', command: () => {} }
        ]"
      />
    `
  })
}

/** Custom trigger button. */
export const CustomTrigger: Story = {
  render: () => ({
    components: { Popover, Button },
    template: `
      <Popover
        :entries="[
          { label: 'Option A', command: () => {} },
          { label: 'Option B', command: () => {} }
        ]"
      >
        <template #button>
          <Button variant="outline">Click me</Button>
        </template>
      </Popover>
    `
  })
}

/** Action prompt: small inline confirmation bubble. */
export const ActionPrompt: Story = {
  render: () => ({
    components: { Popover, Button },
    template: `
      <Popover>
        <template #button>
          <Button variant="outline" size="sm">
            <i class="icon-[lucide--layout-grid] mr-1 size-3.5" />
            Group
          </Button>
        </template>
        <template #default="{ close }">
          <div class="flex flex-col gap-2 p-1">
            <p class="text-sm text-muted-foreground">Group into a row?</p>
            <div class="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                class="flex-1"
                @click="close()"
              >
                Yes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                class="flex-1"
                @click="close()"
              >
                No
              </Button>
            </div>
          </div>
        </template>
      </Popover>
    `
  })
}

/** Alignment prompt: contextual bubble for zone actions. */
export const AlignPrompt: Story = {
  render: () => ({
    components: { Popover, Button },
    template: `
      <Popover>
        <template #button>
          <Button variant="ghost" size="sm">
            <i class="icon-[lucide--align-vertical-justify-end] size-4" />
          </Button>
        </template>
        <template #default="{ close }">
          <div class="flex flex-col gap-1.5 p-1">
            <button
              class="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-secondary-background"
              @click="close()"
            >
              <i class="icon-[lucide--arrow-down-to-line] size-4" />
              Align to bottom
            </button>
            <button
              class="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-secondary-background"
              @click="close()"
            >
              <i class="icon-[lucide--columns-2] size-4" />
              Group into row
            </button>
          </div>
        </template>
      </Popover>
    `
  })
}

/** On light background — verify popover visibility. */
export const OnLightBackground: Story = {
  parameters: {
    backgrounds: { default: 'light' }
  },
  render: () => ({
    components: { Popover, Button },
    template: `
      <Popover>
        <template #button>
          <Button>Open popover</Button>
        </template>
        <template #default="{ close }">
          <div class="p-2">
            <p class="text-sm">Popover on light background</p>
            <Button size="sm" class="mt-2" @click="close()">Close</Button>
          </div>
        </template>
      </Popover>
    `
  })
}

/** On sidebar background — verify contrast against dark sidebar. */
export const OnSidebarBackground: Story = {
  parameters: {
    backgrounds: { default: 'sidebar' }
  },
  render: () => ({
    components: { Popover, Button },
    template: `
      <Popover>
        <template #button>
          <Button>Open popover</Button>
        </template>
        <template #default="{ close }">
          <div class="p-2">
            <p class="text-sm">Popover on sidebar background</p>
            <Button size="sm" class="mt-2" @click="close()">Close</Button>
          </div>
        </template>
      </Popover>
    `
  })
}

/** No arrow variant. */
export const NoArrow: Story = {
  render: () => ({
    components: { Popover },
    template: `
      <Popover
        :show-arrow="false"
        :entries="[
          { label: 'Settings', icon: 'icon-[lucide--settings]', command: () => {} },
          { label: 'Help', icon: 'icon-[lucide--circle-help]', command: () => {} }
        ]"
      />
    `
  })
}

/** Disabled entry. */
export const WithDisabled: Story = {
  render: () => ({
    components: { Popover },
    template: `
      <Popover
        :entries="[
          { label: 'Available', command: () => {} },
          { label: 'Coming soon', disabled: true }
        ]"
      />
    `
  })
}
