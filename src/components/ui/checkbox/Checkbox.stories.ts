import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { CheckboxCheckedState } from 'reka-ui'
import { ref } from 'vue'

import Checkbox from './Checkbox.vue'

const meta: Meta<typeof Checkbox> = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    'onUpdate:modelValue': { action: 'update:modelValue' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

function renderCheckbox(initialValue: CheckboxCheckedState) {
  function render(args: { disabled?: boolean }) {
    return {
      components: { Checkbox },
      setup() {
        const checked = ref<CheckboxCheckedState>(initialValue)
        return { args, checked }
      },
      template: `
        <label class="flex items-center gap-2">
          <Checkbox v-model="checked" :disabled="args.disabled" />
          Show links
        </label>
      `
    }
  }

  return render
}

export const Default: Story = {
  render: renderCheckbox(false)
}

export const Checked: Story = {
  render: renderCheckbox(true)
}

export const Indeterminate: Story = {
  render: renderCheckbox('indeterminate')
}

export const Disabled: Story = {
  render: renderCheckbox(true),
  args: { disabled: true }
}
