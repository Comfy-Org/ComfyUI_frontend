import type { Meta, StoryObj } from '@storybook/vue3-vite'

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
    border: {
      control: 'boolean',
      description: 'Toggle border attribute'
    },
    disabled: {
      control: 'boolean',
      description: 'Toggle disable status'
    },
    onClick: { action: 'clicked' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  render: (args) => ({
    components: { IconButton },
    setup() {
      return { args }
    },
    template: `
      <IconButton v-bind="args">
        <i class="icon-[lucide--trophy] size-4" />
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
    components: { IconButton },
    setup() {
      return { args }
    },
    template: `
      <IconButton v-bind="args">
        <i class="icon-[lucide--settings] size-4" />
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
    components: { IconButton },
    setup() {
      return { args }
    },
    template: `
      <IconButton v-bind="args">
        <i class="icon-[lucide--x] size-4" />
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
    components: { IconButton },
    setup() {
      return { args }
    },
    template: `
      <IconButton v-bind="args">
        <i class="icon-[lucide--bell] size-3" />
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
    components: { IconButton },
    template: `
      <div class="flex flex-col gap-4">
        <div class="flex gap-2 items-center">
          <IconButton type="primary" size="sm" @click="() => {}">
            <i class="icon-[lucide--trophy] size-3" />
          </IconButton>
          <IconButton type="primary" size="md" @click="() => {}">
            <i class="icon-[lucide--trophy] size-4" />
          </IconButton>
        </div>
        <div class="flex gap-2 items-center">
          <IconButton type="secondary" size="sm" @click="() => {}">
            <i class="icon-[lucide--settings] size-3" />
          </IconButton>
          <IconButton type="secondary" size="md" @click="() => {}">
            <i class="icon-[lucide--settings] size-4" />
          </IconButton>
        </div>
        <div class="flex gap-2 items-center">
          <IconButton type="transparent" size="sm" @click="() => {}">
            <i class="icon-[lucide--x] size-3" />
          </IconButton>
          <IconButton type="transparent" size="md" @click="() => {}">
            <i class="icon-[lucide--x] size-4" />
          </IconButton>
        </div>
        <div class="flex gap-2 items-center">
          <IconButton type="primary" size="md" @click="() => {}">
            <i class="icon-[lucide--bell] size-4" />
          </IconButton>
          <IconButton type="secondary" size="md" @click="() => {}">
            <i class="icon-[lucide--heart] size-4" />
          </IconButton>
          <IconButton type="transparent" size="md" @click="() => {}">
            <i class="icon-[lucide--download] size-4" />
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
