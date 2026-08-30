import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import RadioGroup from './RadioGroup.vue'
import RadioGroupItem from './RadioGroupItem.vue'

const meta = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    'onUpdate:modelValue': { action: 'update:modelValue' }
  }
} satisfies Meta<typeof RadioGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render(args) {
    return {
      components: { RadioGroup, RadioGroupItem },
      setup() {
        const value = ref('balanced')
        return { args, value }
      },
      template: `
        <RadioGroup v-model="value" :disabled="args.disabled">
          <label class="flex items-center gap-2">
            <RadioGroupItem value="fast" />
            Fast
          </label>
          <label class="flex items-center gap-2">
            <RadioGroupItem value="balanced" />
            Balanced
          </label>
          <label class="flex items-center gap-2">
            <RadioGroupItem value="quality" />
            Quality
          </label>
        </RadioGroup>
      `
    }
  }
}

export const Disabled: Story = {
  ...Default,
  args: { disabled: true }
}
