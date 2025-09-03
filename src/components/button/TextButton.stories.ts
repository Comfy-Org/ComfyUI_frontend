import type { Meta, StoryObj } from '@storybook/vue3-vite'

import TextButton from './TextButton.vue'

const meta: Meta<typeof TextButton> = {
  title: 'Components/Button/TextButton',
  component: TextButton,
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      defaultValue: 'Click me'
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md'],
      defaultValue: 'md'
    },
    border: {
      control: 'boolean',
      description: 'Toggle border attribute'
    },
    disabled: {
      control: 'boolean',
      description: 'Toggle disable status'
    },
    type: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'transparent'],
      defaultValue: 'primary'
    },
    onClick: { action: 'clicked' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    label: 'Primary Button',
    type: 'primary',
    size: 'md'
  }
}

export const Secondary: Story = {
  args: {
    label: 'Secondary Button',
    type: 'secondary',
    size: 'md'
  }
}

export const Transparent: Story = {
  args: {
    label: 'Transparent Button',
    type: 'transparent',
    size: 'md'
  }
}

export const Small: Story = {
  args: {
    label: 'Small Button',
    type: 'primary',
    size: 'sm'
  }
}

export const AllVariants: Story = {
  render: () => ({
    components: { TextButton },
    template: `
      <div class="flex flex-col gap-4">
        <div class="flex gap-2 items-center">
          <TextButton label="Primary Small" type="primary" size="sm" @click="() => {}" />
          <TextButton label="Primary Medium" type="primary" size="md" @click="() => {}" />
        </div>
        <div class="flex gap-2 items-center">
          <TextButton label="Secondary Small" type="secondary" size="sm" @click="() => {}" />
          <TextButton label="Secondary Medium" type="secondary" size="md" @click="() => {}" />
        </div>
        <div class="flex gap-2 items-center">
          <TextButton label="Transparent Small" type="transparent" size="sm" @click="() => {}" />
          <TextButton label="Transparent Medium" type="transparent" size="md" @click="() => {}" />
        </div>
      </div>
    `
  })
}
