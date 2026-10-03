import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Checkbox from './Checkbox.vue'

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    'onUpdate:modelValue': { action: 'update:modelValue' }
  }
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

function renderCheckbox(initialValue: boolean) {
  function render(args: { disabled?: boolean }) {
    return {
      components: { Checkbox },
      setup() {
        const checked = ref(initialValue)
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

export const Disabled: Story = {
  render: renderCheckbox(true),
  args: { disabled: true }
}
