import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { ref, toRefs } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/Popover.vue'

import ScrubableNumberInput from './ScrubableNumberInput.vue'

type StoryArgs = ComponentPropsAndSlots<typeof ScrubableNumberInput>

const meta: Meta<StoryArgs> = {
  title: 'Components/Input/Number',
  component: ScrubableNumberInput,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    disabled: { control: 'boolean' },
    hideButtons: { control: 'boolean' }
  },
  args: {
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    hideButtons: false
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-60"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { ScrubableNumberInput },
    setup() {
      const { min, max, step, disabled, hideButtons } = toRefs(args)
      const value = ref(42)
      return { value, min, max, step, disabled, hideButtons }
    },
    template:
      '<ScrubableNumberInput v-model="value" :min :max :step :disabled :hideButtons />'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { ScrubableNumberInput },
    setup() {
      const { disabled } = toRefs(args)
      const value = ref(50)
      return { value, disabled }
    },
    template:
      '<ScrubableNumberInput v-model="value" :min="0" :max="100" :step="1" :disabled />'
  })
}

export const AtMinimum: Story = {
  render: () => ({
    components: { ScrubableNumberInput },
    setup() {
      const value = ref(0)
      return { value }
    },
    template:
      '<ScrubableNumberInput v-model="value" :min="0" :max="100" :step="1" />'
  })
}

export const AtMaximum: Story = {
  render: () => ({
    components: { ScrubableNumberInput },
    setup() {
      const value = ref(100)
      return { value }
    },
    template:
      '<ScrubableNumberInput v-model="value" :min="0" :max="100" :step="1" />'
  })
}

export const FloatPrecision: Story = {
  args: { min: 0, max: 1, step: 0.01 },
  render: (args) => ({
    components: { ScrubableNumberInput },
    setup() {
      const { min, max, step } = toRefs(args)
      const value = ref(0.75)
      return { value, min, max, step }
    },
    template:
      '<ScrubableNumberInput v-model="value" :min :max :step display-value="0.75" />'
  })
}

export const LargeNumber: Story = {
  render: () => ({
    components: { ScrubableNumberInput },
    setup() {
      const value = ref(1809000312992)
      return { value }
    },
    template:
      '<ScrubableNumberInput v-model="value" :min="0" :max="Number.MAX_SAFE_INTEGER" :step="1" />'
  })
}

export const HiddenButtons: Story = {
  args: { hideButtons: true },
  render: (args) => ({
    components: { ScrubableNumberInput },
    setup() {
      const { hideButtons } = toRefs(args)
      const value = ref(42)
      return { value, hideButtons }
    },
    template:
      '<ScrubableNumberInput v-model="value" :min="0" :max="100" :step="1" :hideButtons />'
  })
}

export const WithControlButton: Story = {
  render: () => ({
    components: { ScrubableNumberInput, Button, Popover },
    setup() {
      const value = ref(1809000312992)
      return { value }
    },
    template: `
      <ScrubableNumberInput v-model="value" :min="0" :max="Number.MAX_SAFE_INTEGER" :step="1">
        <Popover>
          <template #button>
            <Button
              variant="textonly"
              size="sm"
              class="h-4 w-7 self-center rounded-xl bg-primary-background/30 p-0 hover:bg-primary-background-hover/30"
            >
              <i class="icon-[lucide--shuffle] w-full text-xs text-primary-background" />
            </Button>
          </template>
          <div class="p-4 text-sm">Control popover content</div>
        </Popover>
      </ScrubableNumberInput>
    `
  })
}
