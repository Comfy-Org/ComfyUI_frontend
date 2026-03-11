import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { computed, ref, toRefs } from 'vue'

import Slider from './Slider.vue'

interface StoryArgs extends ComponentPropsAndSlots<typeof Slider> {
  disabled: boolean
}

const meta: Meta<StoryArgs> = {
  title: 'Components/Slider',
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
      template: '<div class="w-72"><story /></div>'
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
      const display = computed(() => value.value[0])
      return { value, display, min, max, step, disabled }
    },
    template: `
      <div class="flex items-center gap-4 rounded-lg bg-component-node-widget-background px-3 py-2">
        <Slider v-model="value" :min :max :step :disabled class="flex-1" />
        <span class="w-14 shrink-0 text-right text-xs text-component-node-foreground">{{ display }}</span>
      </div>
    `
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { Slider },
    setup() {
      const { min, max, step, disabled } = toRefs(args)
      const value = ref([36])
      const display = computed(() => value.value[0])
      return { value, display, min, max, step, disabled }
    },
    template: `
      <div class="flex items-center gap-4 rounded-lg bg-component-node-widget-background px-3 py-2">
        <Slider v-model="value" :min :max :step :disabled class="flex-1" />
        <span class="w-14 shrink-0 text-right text-xs text-component-node-foreground">{{ display }}</span>
      </div>
    `
  })
}
