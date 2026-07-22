import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Switch from './Switch.vue'

const meta = {
  title: 'Components/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    'onUpdate:modelValue': { action: 'update:modelValue' }
  }
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

function renderSwitch(initialValue: boolean) {
  return (args: { disabled?: boolean }) => ({
    components: { Switch },
    setup() {
      const checked = ref(initialValue)
      return { args, checked }
    },
    template: `
      <Switch
        v-model="checked"
        :disabled="args.disabled"
        aria-label="Auto-reload credits"
      />
    `
  })
}

export const Default: Story = {
  render: renderSwitch(false),
  args: { disabled: false }
}

export const Checked: Story = {
  render: renderSwitch(true),
  args: { disabled: false }
}

export const Disabled: Story = {
  render: renderSwitch(true),
  args: { disabled: true }
}
