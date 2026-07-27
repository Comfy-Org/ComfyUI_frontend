import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import FilterMultiCombobox from './FilterMultiCombobox.vue'

const meta: Meta<typeof FilterMultiCombobox> = {
  title: 'Components/FilterMultiCombobox',
  component: FilterMultiCombobox,
  tags: ['autodocs'],
  args: {
    label: 'Model Filter'
  }
}

export default meta
type Story = StoryObj<typeof meta>

const OPTIONS = [
  { name: 'ByteDance', value: 'bytedance' },
  { name: 'ACE-Step', value: 'ace-step' },
  { name: 'Anima', value: 'anima' },
  { name: 'BRIA', value: 'bria' },
  { name: 'Capybara', value: 'capybara' },
  { name: 'Chatter Box', value: 'chatter-box' },
  { name: 'ElevenLabs', value: 'elevenlabs' },
  { name: 'Google', value: 'google' },
  { name: 'Kling', value: 'kling' }
]

export const Default: Story = {
  render: (args) => ({
    components: { FilterMultiCombobox },
    setup() {
      const selected = ref<string[]>(['bytedance', 'anima'])
      return { selected, OPTIONS, args }
    },
    template: `
      <div class="w-64 p-8">
        <FilterMultiCombobox v-model="selected" :label="args.label" :options="OPTIONS" />
        <div class="mt-4 text-sm text-muted-foreground">
          Selected: {{ selected.join(', ') || 'none' }}
        </div>
      </div>
    `
  })
}

export const Empty: Story = {
  render: (args) => ({
    components: { FilterMultiCombobox },
    setup() {
      const selected = ref<string[]>([])
      return { selected, OPTIONS, args }
    },
    template: `
      <div class="w-64 p-8">
        <FilterMultiCombobox v-model="selected" :label="args.label" :options="OPTIONS" />
      </div>
    `
  })
}
