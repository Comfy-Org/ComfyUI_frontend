import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Bell, Download, Heart, Settings, Trophy, X } from 'lucide-vue-next'

import IconButton from './IconButton.vue'

const meta: Meta<typeof IconButton> = {
  title: 'Components/Button/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md']
    },
    type: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'transparent']
    },
    onClick: { action: 'clicked' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  render: (args) => ({
    components: { IconButton, Trophy },
    setup() {
      return { args }
    },
    template: `
      <IconButton v-bind="args">
        <Trophy :size="16" />
      </IconButton>
    `
  }),
  args: {
    type: 'primary',
    size: 'md'
  }
}

export const Secondary: Story = {
  render: (args) => ({
    components: { IconButton, Settings },
    setup() {
      return { args }
    },
    template: `
      <IconButton v-bind="args">
        <Settings :size="16" />
      </IconButton>
    `
  }),
  args: {
    type: 'secondary',
    size: 'md'
  }
}

export const Transparent: Story = {
  render: (args) => ({
    components: { IconButton, X },
    setup() {
      return { args }
    },
    template: `
      <IconButton v-bind="args">
        <X :size="16" />
      </IconButton>
    `
  }),
  args: {
    type: 'transparent',
    size: 'md'
  }
}

export const Small: Story = {
  render: (args) => ({
    components: { IconButton, Bell },
    setup() {
      return { args }
    },
    template: `
      <IconButton v-bind="args">
        <Bell :size="12" />
      </IconButton>
    `
  }),
  args: {
    type: 'secondary',
    size: 'sm'
  }
}

export const AllVariants: Story = {
  render: () => ({
    components: { IconButton, Trophy, Settings, X, Bell, Heart, Download },
    template: `
      <div class="flex flex-col gap-4">
        <div class="flex gap-2 items-center">
          <IconButton type="primary" size="sm" @click="() => {}">
            <Trophy :size="12" />
          </IconButton>
          <IconButton type="primary" size="md" @click="() => {}">
            <Trophy :size="16" />
          </IconButton>
        </div>
        <div class="flex gap-2 items-center">
          <IconButton type="secondary" size="sm" @click="() => {}">
            <Settings :size="12" />
          </IconButton>
          <IconButton type="secondary" size="md" @click="() => {}">
            <Settings :size="16" />
          </IconButton>
        </div>
        <div class="flex gap-2 items-center">
          <IconButton type="transparent" size="sm" @click="() => {}">
            <X :size="12" />
          </IconButton>
          <IconButton type="transparent" size="md" @click="() => {}">
            <X :size="16" />
          </IconButton>
        </div>
        <div class="flex gap-2 items-center">
          <IconButton type="primary" size="md" @click="() => {}">
            <Bell :size="16" />
          </IconButton>
          <IconButton type="secondary" size="md" @click="() => {}">
            <Heart :size="16" />
          </IconButton>
          <IconButton type="transparent" size="md" @click="() => {}">
            <Download :size="16" />
          </IconButton>
        </div>
      </div>
    `
  }),
  parameters: {
    controls: { disable: true },
    actions: { disable: true }
  }
}
