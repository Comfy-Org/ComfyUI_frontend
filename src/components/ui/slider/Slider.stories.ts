import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { ref, toRefs } from 'vue'

import Slider from './Slider.vue'

type StoryArgs = ComponentPropsAndSlots<typeof Slider>

const meta: Meta<StoryArgs> = {
  title: 'Components/Slider/Slider',
  component: Slider,
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
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-64"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { Slider },
    setup() {
      const { min, max, step, disabled } = toRefs(args)
      const value = ref([36])
      return { value, min, max, step, disabled }
    },
    template: '<Slider v-model="value" :min :max :step :disabled />'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { Slider },
    setup() {
      const { disabled } = toRefs(args)
      const value = ref([50])
      return { value, disabled }
    },
    template:
      '<Slider v-model="value" :min="0" :max="100" :step="1" :disabled />'
  })
}

export const AtMinimum: Story = {
  render: () => ({
    components: { Slider },
    setup() {
      const value = ref([0])
      return { value }
    },
    template: '<Slider v-model="value" :min="0" :max="100" :step="1" />'
  })
}

export const AtMaximum: Story = {
  render: () => ({
    components: { Slider },
    setup() {
      const value = ref([100])
      return { value }
    },
    template: '<Slider v-model="value" :min="0" :max="100" :step="1" />'
  })
}

export const Midpoint: Story = {
  render: () => ({
    components: { Slider },
    setup() {
      const value = ref([50])
      return { value }
    },
    template: '<Slider v-model="value" :min="0" :max="100" :step="1" />'
  })
}

export const FloatPrecision: Story = {
  args: { min: 0, max: 1, step: 0.01 },
  render: (args) => ({
    components: { Slider },
    setup() {
      const { min, max, step } = toRefs(args)
      const value = ref([0.75])
      return { value, min, max, step }
    },
    template: '<Slider v-model="value" :min :max :step />'
  })
}

export const AllVariants: Story = {
  render: () => ({
    components: { Slider },
    setup() {
      const defaultVal = ref([36])
      const disabledVal = ref([36])
      const minVal = ref([0])
      const maxVal = ref([100])
      return { defaultVal, disabledVal, minVal, maxVal }
    },
    template: `
      <div class="flex w-64 flex-col gap-6">
        <div class="flex flex-col gap-1">
          <span class="text-xs uppercase text-neutral-500">Default</span>
          <Slider v-model="defaultVal" :min="0" :max="100" :step="1" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs uppercase text-neutral-500">Disabled</span>
          <Slider v-model="disabledVal" :min="0" :max="100" :step="1" disabled />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs uppercase text-neutral-500">At Minimum</span>
          <Slider v-model="minVal" :min="0" :max="100" :step="1" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs uppercase text-neutral-500">At Maximum</span>
          <Slider v-model="maxVal" :min="0" :max="100" :step="1" />
        </div>
      </div>
    `
  })
}
