import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Checkbox from './Checkbox.vue'

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'When true, disables the checkbox'
    },
    'onUpdate:modelValue': { action: 'update:modelValue' }
  }
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { Checkbox },
    setup() {
      const checked = ref(false)
      return { checked, args }
    },
    template: `
      <div class="flex items-center gap-2">
        <Checkbox v-model="checked" :disabled="args.disabled" />
        <span class="text-sm text-muted-foreground">Checked: {{ checked }}</span>
      </div>
    `
  }),
  args: {
    disabled: false
  }
}

export const Checked: Story = {
  render: () => ({
    components: { Checkbox },
    setup() {
      const checked = ref(true)
      return { checked }
    },
    template: `<Checkbox v-model="checked" />`
  }),
  args: {}
}

export const Disabled: Story = {
  render: () => ({
    components: { Checkbox },
    setup() {
      const checked = ref(false)
      return { checked }
    },
    template: `<Checkbox v-model="checked" disabled />`
  }),
  args: {}
}
