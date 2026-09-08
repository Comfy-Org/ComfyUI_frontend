import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Switch from './Switch.vue'

const meta = {
  title: 'Components/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    'onUpdate:modelValue': { action: 'update:modelValue' }
  }
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

function renderSwitch(initialValue: boolean) {
  function render(args: { disabled?: boolean; readonly?: boolean }) {
    return {
      components: { Switch },
      setup() {
        const checked = ref(initialValue)
        return { args, checked }
      },
      template: `
        <Switch
          v-model="checked"
          :disabled="args.disabled"
          :readonly="args.readonly"
          aria-label="Example switch"
        />
      `
    }
  }

  return render
}

export const Default: Story = {
  render: renderSwitch(false)
}

export const Checked: Story = {
  render: renderSwitch(true)
}

export const Disabled: Story = {
  render: renderSwitch(true),
  args: { disabled: true }
}

export const Readonly: Story = {
  render: renderSwitch(true),
  args: { readonly: true }
}
