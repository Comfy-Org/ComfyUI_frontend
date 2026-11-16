import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn } from 'storybook/test'
import { computed, ref, watch } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetSelectDefault from './WidgetSelectDefault.vue'

const meta: Meta<{
  value: string
  width: number
  advanced: boolean
  disabled: boolean
  onChange: ReturnType<typeof fn>
}> = {
  title: 'Widgets/WidgetSelectDefault',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    value: 'portrait.safetensors',
    width: 300,
    advanced: false,
    disabled: false,
    onChange: fn()
  },
  render: (args) => ({
    components: { WidgetSelectDefault },
    setup() {
      const value = ref(args.value)
      watch(
        () => args.value,
        (next) => {
          value.value = next
        }
      )
      const widget = computed<SimplifiedWidget<string>>(() => ({
        name: 'checkpoint',
        type: 'COMBO',
        value: value.value,
        borderStyle: args.advanced ? 'ring ring-primary' : undefined,
        options: {
          values: ['portrait.safetensors', 'landscape.safetensors'],
          disabled: args.disabled
        }
      }))
      return { args, widget, value }
    },
    template: `
      <div class="bg-node p-4 text-xs" :style="{ width: args.width + 'px' }">
        <WidgetSelectDefault v-model="value" :widget @update:model-value="args.onChange" />
      </div>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const MissingModel: Story = {
  args: { value: 'missing-model.safetensors' },
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: 'checkpoint' })
    await expect(trigger).toHaveAttribute('aria-invalid', 'true')
    await userEvent.tab()
    await expect(trigger).toHaveFocus()
  }
}
