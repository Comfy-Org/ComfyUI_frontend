import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from './Button.vue'

const meta: Meta<typeof Button> = {
  title: 'Components/Button/NewButton',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      defaultValue: 'md'
    },
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'transparent'],
      defaultValue: 'primary'
    },
    as: { defaultValue: 'button' },
    asChild: { defaultValue: false },
    default: {
      defaultValue: 'Button'
    }
  },
  args: {
    variant: 'secondary',
    size: 'md',
    default: 'Button'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    variant: 'primary',
    size: 'md'
  }
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    size: 'md'
  }
}

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    size: 'md'
  }
}

export const Small: Story = {
  args: {
    variant: 'primary',
    size: 'sm'
  }
}

export const AllVariants: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div class="grid grid-cols-3 gap-4">
        <div class="grid grid-cols-subgrid col-span-full items-center">
          <Button variant="primary" size="sm">Primary Small</Button>
          <Button variant="primary" size="md">Primary Medium</Button>
          <Button variant="primary" size="lg">Primary Large</Button>
        </div>
        <div class="grid grid-cols-subgrid col-span-full items-center">
          <Button variant="secondary" size="sm">Secondary Small</Button>
          <Button variant="secondary" size="md" >Secondary Medium</Button>
          <Button variant="secondary" size="lg" >Secondary Large</Button>
        </div>
        <div class="grid grid-cols-subgrid col-span-full items-center">
          <Button variant="destructive" size="sm">Destructive Small</Button>
          <Button variant="destructive" size="md">Destructive Medium</Button>
          <Button variant="destructive" size="lg">Destructive Large</Button>
        </div>
      </div>
    `
  })
}
