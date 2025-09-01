import type { Meta, StoryObj } from '@storybook/vue3-vite'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Package,
  Save,
  Settings,
  Trash2,
  X
} from 'lucide-vue-next'

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
    components: { IconTextButton, Package },
    setup() {
      return { args }
    },
    template: `
      <IconTextButton v-bind="args">
        <template #icon>
          <Package :size="16" />
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
    components: { IconTextButton, Settings },
    setup() {
      return { args }
    },
    template: `
      <IconTextButton v-bind="args">
        <template #icon>
          <Settings :size="16" />
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
    components: { IconTextButton, X },
    setup() {
      return { args }
    },
    template: `
      <IconTextButton v-bind="args">
        <template #icon>
          <X :size="16" />
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
    components: { IconTextButton, ChevronRight },
    setup() {
      return { args }
    },
    template: `
      <IconTextButton v-bind="args">
        <template #icon>
          <ChevronRight :size="16" />
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
    components: { IconTextButton, Save },
    setup() {
      return { args }
    },
    template: `
      <IconTextButton v-bind="args">
        <template #icon>
          <Save :size="12" />
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
      IconTextButton,
      Download,
      Settings,
      Trash2,
      ChevronRight,
      ChevronLeft,
      Save
    },
    template: `
      <div class="flex flex-col gap-4">
        <div class="flex gap-2 items-center">
          <IconTextButton label="Download" type="primary" size="sm" @click="() => {}">
            <template #icon>
              <Download :size="12" />
            </template>
          </IconTextButton>
          <IconTextButton label="Download" type="primary" size="md" @click="() => {}">
            <template #icon>
              <Download :size="16" />
            </template>
          </IconTextButton>
        </div>
        <div class="flex gap-2 items-center">
          <IconTextButton label="Settings" type="secondary" size="sm" @click="() => {}">
            <template #icon>
              <Settings :size="12" />
            </template>
          </IconTextButton>
          <IconTextButton label="Settings" type="secondary" size="md" @click="() => {}">
            <template #icon>
              <Settings :size="16" />
            </template>
          </IconTextButton>
        </div>
        <div class="flex gap-2 items-center">
          <IconTextButton label="Delete" type="transparent" size="sm" @click="() => {}">
            <template #icon>
              <Trash2 :size="12" />
            </template>
          </IconTextButton>
          <IconTextButton label="Delete" type="transparent" size="md" @click="() => {}">
            <template #icon>
              <Trash2 :size="16" />
            </template>
          </IconTextButton>
        </div>
        <div class="flex gap-2 items-center">
          <IconTextButton label="Next" type="primary" size="md" iconPosition="right" @click="() => {}">
            <template #icon>
              <ChevronRight :size="16" />
            </template>
          </IconTextButton>
          <IconTextButton label="Previous" type="secondary" size="md" @click="() => {}">
            <template #icon>
              <ChevronLeft :size="16" />
            </template>
          </IconTextButton>
          <IconTextButton label="Save File" type="primary" size="md" @click="() => {}">
            <template #icon>
              <Save :size="16" />
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
