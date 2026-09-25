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

function renderRadioGroup(initialValue?: string) {
  function render(args: { disabled?: boolean }) {
    return {
      components: { RadioGroup, RadioGroupItem },
      setup() {
        const value = ref(initialValue)
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

  return render
}

export const Default: Story = {
  render: renderRadioGroup()
}

export const Preselected: Story = {
  render: renderRadioGroup('balanced')
}

export const Disabled: Story = {
  render: renderRadioGroup('balanced'),
  args: { disabled: true }
}

export const WithDescriptions: Story = {
  render(args) {
    return {
      components: { RadioGroup, RadioGroupItem },
      setup() {
        const value = ref('increment')
        const options = [
          {
            value: 'fixed',
            title: 'Fixed',
            description: 'Keep the value between runs'
          },
          {
            value: 'increment',
            title: 'Increment',
            description: 'Add the step after every run'
          },
          {
            value: 'randomize',
            title: 'Randomize',
            description: 'Pick a new random value after every run'
          }
        ]
        return { args, value, options }
      },
      template: `
        <RadioGroup v-model="value" :disabled="args.disabled" class="w-72 flex-col gap-2">
          <div
            v-for="option in options"
            :key="option.value"
            class="flex items-center justify-between gap-7 py-2"
          >
            <label :for="option.value" class="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
              <span class="text-sm/tight text-base-foreground">{{ option.title }}</span>
              <span class="text-sm/tight text-muted-foreground">{{ option.description }}</span>
            </label>
            <RadioGroupItem :id="option.value" :value="option.value" />
          </div>
        </RadioGroup>
      `
    }
  }
}
