import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Checkbox from './Checkbox.vue'

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  render: (args) => ({
    components: { Checkbox },
    setup() {
      return { args, checked: ref(args.defaultValue ?? false) }
    },
    template: '<Checkbox v-model="checked" v-bind="args" />'
  })
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Checked: Story = {
  args: { defaultValue: true }
}

export const Disabled: Story = {
  args: { disabled: true }
}
