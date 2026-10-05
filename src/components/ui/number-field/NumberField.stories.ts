import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { ref, toRefs } from 'vue'

import NumberField from './NumberField.vue'
import NumberFieldDecrement from './NumberFieldDecrement.vue'
import NumberFieldIncrement from './NumberFieldIncrement.vue'
import NumberFieldInput from './NumberFieldInput.vue'

type StoryArgs = ComponentPropsAndSlots<typeof NumberField>

const meta: Meta<StoryArgs> = {
  title: 'Components/NumberField',
  component: NumberField,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    disabled: { control: 'boolean' }
  },
  args: {
    min: 0,
    max: 100,
    step: 1,
    disabled: false
  }
}

export default meta
type Story = StoryObj<typeof meta>

function renderNumberField(children: string, initialValue: number) {
  return (args: StoryArgs) => ({
    components: {
      NumberField,
      NumberFieldDecrement,
      NumberFieldIncrement,
      NumberFieldInput
    },
    setup() {
      const { min, max, step, disabled, formatOptions } = toRefs(args)
      const value = ref(initialValue)
      return { value, min, max, step, disabled, formatOptions }
    },
    template: `
      <NumberField v-model="value" :min :max :step :disabled :format-options="formatOptions" class="w-32">
        ${children}
      </NumberField>
    `
  })
}

const stepperChildren = `
  <NumberFieldDecrement />
  <NumberFieldInput aria-label="Amount" />
  <NumberFieldIncrement />
`

export const Default: Story = {
  render: renderNumberField(stepperChildren, 36)
}

export const Disabled: Story = {
  args: { disabled: true },
  render: renderNumberField(stepperChildren, 36)
}

export const Decimal: Story = {
  args: {
    min: 0,
    max: 1,
    step: 0.05,
    formatOptions: { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  },
  render: renderNumberField(stepperChildren, 0.5)
}

export const WithPrefix: Story = {
  args: { max: 10000, step: 5, formatOptions: { maximumFractionDigits: 0 } },
  render: renderNumberField(
    `
      <NumberFieldDecrement />
      <span class="shrink-0 text-base font-semibold text-base-foreground">$</span>
      <NumberFieldInput aria-label="Amount in dollars" />
      <NumberFieldIncrement />
    `,
    50
  )
}
