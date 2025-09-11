import type { Meta, StoryObj } from '@storybook/vue3-vite'

import IconTextButton from './IconTextButton.vue'

const meta: Meta<typeof IconTextButton> = {
  title: 'Components/Button/IconTextButton',
  component: IconTextButton,
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text'
    },
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
    iconPosition: {
      control: { type: 'select' },
      options: ['left', 'right']
    },
    onClick: { action: 'clicked' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  render: (args) => ({
    components: { IconTextButton },
    setup() {
      return { args }
    },
    template: `
      <IconTextButton v-bind="args">
        <template #icon>
          <i class="icon-[lucide--package] size-4" />
        </template>
      </IconTextButton>
    `
  }),
  args: {
    label: 'Deploy',
    type: 'primary',
    size: 'md'
  }
}

export const Secondary: Story = {
  render: (args) => ({
    components: { IconTextButton },
    setup() {
      return { args }
    },
    template: `
      <IconTextButton v-bind="args">
        <template #icon>
          <i class="icon-[lucide--settings] size-4" />
        </template>
      </IconTextButton>
    `
  }),
  args: {
    label: 'Settings',
    type: 'secondary',
    size: 'md'
  }
}

export const Transparent: Story = {
  render: (args) => ({
    components: { IconTextButton },
    setup() {
      return { args }
    },
    template: `
      <IconTextButton v-bind="args">
        <template #icon>
          <i class="icon-[lucide--x] size-4" />
        </template>
      </IconTextButton>
    `
  }),
  args: {
    label: 'Cancel',
    type: 'transparent',
    size: 'md'
  }
}

export const WithIconRight: Story = {
  render: (args) => ({
    components: { IconTextButton },
    setup() {
      return { args }
    },
    template: `
      <IconTextButton v-bind="args">
        <template #icon>
          <i class="icon-[lucide--chevron-right] size-4" />
        </template>
      </IconTextButton>
    `
  }),
  args: {
    label: 'Next',
    type: 'primary',
    size: 'md',
    iconPosition: 'right'
  }
}

export const Small: Story = {
  render: (args) => ({
    components: { IconTextButton },
    setup() {
      return { args }
    },
    template: `
      <IconTextButton v-bind="args">
        <template #icon>
          <i class="icon-[lucide--save] size-3" />
        </template>
      </IconTextButton>
    `
  }),
  args: {
    label: 'Save',
    type: 'primary',
    size: 'sm'
  }
}

export const AllVariants: Story = {
  render: () => ({
    components: {
      IconTextButton
    },
    template: `
      <div class="flex flex-col gap-4">
        <div class="flex gap-2 items-center">
          <IconTextButton label="Download" type="primary" size="sm" @click="() => {}">
            <template #icon>
              <i class="icon-[lucide--download] size-3" />
            </template>
          </IconTextButton>
          <IconTextButton label="Download" type="primary" size="md" @click="() => {}">
            <template #icon>
              <i class="icon-[lucide--download] size-4" />
            </template>
          </IconTextButton>
        </div>
        <div class="flex gap-2 items-center">
          <IconTextButton label="Settings" type="secondary" size="sm" @click="() => {}">
            <template #icon>
              <i class="icon-[lucide--settings] size-3" />
            </template>
          </IconTextButton>
          <IconTextButton label="Settings" type="secondary" size="md" @click="() => {}">
            <template #icon>
              <i class="icon-[lucide--settings] size-4" />
            </template>
          </IconTextButton>
        </div>
        <div class="flex gap-2 items-center">
          <IconTextButton label="Delete" type="transparent" size="sm" @click="() => {}">
            <template #icon>
              <i class="icon-[lucide--trash-2] size-3" />
            </template>
          </IconTextButton>
          <IconTextButton label="Delete" type="transparent" size="md" @click="() => {}">
            <template #icon>
              <i class="icon-[lucide--trash-2] size-4" />
            </template>
          </IconTextButton>
        </div>
        <div class="flex gap-2 items-center">
          <IconTextButton label="Next" type="primary" size="md" iconPosition="right" @click="() => {}">
            <template #icon>
              <i class="icon-[lucide--chevron-right] size-4" />
            </template>
          </IconTextButton>
          <IconTextButton label="Previous" type="secondary" size="md" @click="() => {}">
            <template #icon>
              <i class="icon-[lucide--chevron-left] size-4" />
            </template>
          </IconTextButton>
          <IconTextButton label="Save File" type="primary" size="md" @click="() => {}">
            <template #icon>
              <i class="icon-[lucide--save] size-4" />
            </template>
          </IconTextButton>
        </div>
      </div>
    `
  }),
  parameters: {
    controls: { disable: true },
    actions: { disable: true }
  }
}
