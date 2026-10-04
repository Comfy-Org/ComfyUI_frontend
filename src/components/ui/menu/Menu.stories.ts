import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'

import Menu from './Menu.vue'

const meta: Meta<typeof Menu> = {
  title: 'Components/Menu',
  component: Menu,
  tags: ['autodocs'],
  args: {
    items: [
      { label: 'Open', icon: 'icon-[lucide--folder-open]', command: fn() },
      { label: 'Disabled', disabled: true },
      { separator: true },
      { label: 'More', items: [{ label: 'Nested item', command: fn() }] }
    ]
  },
  render: (args) => ({
    components: { Button, Menu },
    setup: () => ({ args, open: ref(false) }),
    template:
      '<Menu v-bind="args" v-model:open="open"><template #trigger><Button>Open menu</Button></template></Menu>'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = {
  args: { items: [{ label: 'Disabled item', disabled: true }] }
}
export const Nested: Story = {
  args: {
    items: [{ label: 'Parent', items: [{ label: 'Child', command: fn() }] }]
  }
}
