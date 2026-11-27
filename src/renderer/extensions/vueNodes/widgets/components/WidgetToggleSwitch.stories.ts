import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn } from 'storybook/test'
import { computed, ref, watch } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetToggleSwitch from './WidgetToggleSwitch.vue'

const meta: Meta<{
  value: boolean
  labelled: boolean
  onLabel: string
  offLabel: string
  disabled: boolean
  readOnly: boolean
  onChange: ReturnType<typeof fn>
}> = {
  title: 'Widgets/WidgetToggleSwitch',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    value: false,
    labelled: false,
    onLabel: 'enabled',
    offLabel: 'disabled',
    disabled: false,
    readOnly: false,
    onChange: fn()
  },
  render: (args) => ({
    components: { WidgetToggleSwitch },
    setup() {
      const value = ref(args.value)
      watch(
        () => args.value,
        (next) => {
          value.value = next
        }
      )
      const widget = computed<SimplifiedWidget<boolean>>(() => ({
        name: 'add_noise',
        type: 'BOOLEAN',
        value: value.value,
        options: {
          disabled: args.disabled,
          read_only: args.readOnly,
          ...(args.labelled ? { on: args.onLabel, off: args.offLabel } : {})
        }
      }))
      return { args, widget, value }
    },
    template: `
      <div class="flex w-72 flex-col gap-4 rounded-lg bg-node p-4 text-xs">
        <output aria-label="Value" class="text-muted-foreground">{{ value }}</output>
        <WidgetToggleSwitch v-model="value" :widget @update:model-value="args.onChange" />
      </div>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Switch: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const control = canvas.getByRole('switch', { name: 'add_noise' })
    const value = canvas.getByLabelText('Value')

    await userEvent.click(control)
    await expect(control).toBeChecked()
    await expect(value).toHaveTextContent('true')

    await userEvent.click(canvas.getByText('add_noise'))
    await expect(control).not.toBeChecked()
    await expect(args.onChange).toHaveBeenCalledTimes(2)
  }
}

export const Labelled: Story = {
  args: { labelled: true },
  play: async ({ args, canvas, userEvent }) => {
    const on = canvas.getByRole('button', { name: 'enabled' })
    const off = canvas.getByRole('button', { name: 'disabled' })
    const value = canvas.getByLabelText('Value')

    await userEvent.click(off)
    await expect(args.onChange).not.toHaveBeenCalled()

    await userEvent.click(on)
    await expect(on).toHaveAttribute('data-state', 'on')
    await expect(value).toHaveTextContent('true')

    await userEvent.click(canvas.getByText('add_noise'))
    await expect(off).toHaveAttribute('data-state', 'on')
    await expect(value).toHaveTextContent('false')
    await expect(args.onChange).toHaveBeenCalledTimes(2)
  }
}

export const SwitchDisabled: Story = {
  args: { value: true, disabled: true },
  play: async ({ args, canvas, userEvent }) => {
    const control = canvas.getByRole('switch', { name: 'add_noise' })
    await expect(control).toBeDisabled()

    await userEvent.click(canvas.getByText('add_noise'))
    await expect(control).toBeChecked()
    await expect(args.onChange).not.toHaveBeenCalled()
  }
}

export const SwitchReadOnly: Story = {
  args: { value: true, readOnly: true },
  play: async ({ args, canvas, userEvent }) => {
    const control = canvas.getByRole('switch', { name: 'add_noise' })
    await expect(control).toHaveAttribute('aria-readonly', 'true')

    await userEvent.click(control)
    await userEvent.click(canvas.getByText('add_noise'))
    await expect(control).toBeChecked()
    await expect(args.onChange).not.toHaveBeenCalled()
  }
}

export const LabelledDisabled: Story = {
  args: { ...Labelled.args, disabled: true },
  play: async ({ args, canvas, userEvent }) => {
    const on = canvas.getByRole('button', { name: 'enabled' })
    const off = canvas.getByRole('button', { name: 'disabled' })
    await expect(on).toBeDisabled()
    await expect(off).toBeDisabled()

    await userEvent.click(canvas.getByText('add_noise'))
    await expect(off).toHaveAttribute('data-state', 'on')
    await expect(args.onChange).not.toHaveBeenCalled()
  }
}

export const LabelledReadOnly: Story = {
  args: { ...Labelled.args, readOnly: true },
  play: LabelledDisabled.play
}
