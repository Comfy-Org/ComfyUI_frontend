import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref, toRefs } from 'vue'

import Knob from './Knob.vue'

const meta: Meta<typeof Knob> = {
  title: 'Components/Knob',
  component: Knob,
  tags: ['autodocs'],
  args: { disabled: false, max: 100, min: 0, step: 1 },
  render: (args) => ({
    components: { Knob },
    setup() {
      const value = ref(40)
      return { value, ...toRefs(args) }
    },
    template: `
      <div class="flex items-center gap-3">
        <Knob v-model="value" :disabled :max :min :step aria-label="Strength" />
        <span class="text-sm text-muted-foreground">{{ value }}</span>
      </div>`
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
