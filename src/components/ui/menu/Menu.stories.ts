import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'

import Menu from './Menu.vue'

const meta: Meta<typeof Menu> = {
  title: 'Components/Menu',
  component: Menu,
  args: {
    model: [
      { label: 'Open', icon: 'icon-[lucide--folder-open]' },
      { label: 'Disabled', disabled: true },
      { separator: true },
      { label: 'More', items: [{ label: 'Nested item' }] }
    ]
  },
  render: (args) => ({
    components: { Button, Menu },
    setup() {
      const menu = ref<InstanceType<typeof Menu>>()
      return { args, menu }
    },
    template:
      '<Button @click="menu?.toggle($event)">Open menu</Button><Menu ref="menu" v-bind="args" />'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = {
  args: { model: [{ label: 'Disabled item', disabled: true }] }
}
export const Nested: Story = {
  args: { model: [{ label: 'Parent', items: [{ label: 'Child' }] }] }
}
