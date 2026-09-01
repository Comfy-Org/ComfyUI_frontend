import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetToggleSwitch from './WidgetToggleSwitch.vue'
import { createMockWidget } from './widgetTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      widgets: {
        boolean: {
          true: 'true',
          false: 'false'
        }
      }
    }
  }
})

const ToggleSwitchStub = defineComponent({
  name: 'ToggleSwitch',
  props: {
    modelValue: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },

  emits: ['update:modelValue'],
  template: `<input type="checkbox" role="switch" :checked="modelValue" :disabled="disabled" @change="$emit('update:modelValue', $event.target.checked)" />`
})

describe('WidgetToggleSwitch Value Binding', () => {
  const createToggleWidget = (
    value: boolean = false,
    options: IWidgetOptions = {},
    callback?: (value: boolean) => void
  ) =>
    createMockWidget<boolean>({
      value,
      name: 'test_toggle',
      type: 'boolean',
      options,
      callback
    })

  const mountComponent = (
    widget: SimplifiedWidget<boolean>,
    modelValue: boolean,
    onModelUpdate?: (value: boolean | undefined) => void
  ) => {
    const user = userEvent.setup()
    const result = render(WidgetToggleSwitch, {
      props: {
        widget,
        modelValue,
        ...(onModelUpdate ? { 'onUpdate:modelValue': onModelUpdate } : {})
      },
      global: {
        plugins: [PrimeVue, i18n],
        stubs: { ToggleSwitch: ToggleSwitchStub },
        components: { ToggleGroup, ToggleGroupItem }
      }
    })
    return { ...result, user }
  }

  describe('Vue Event Emission', () => {
    it('emits Vue event when toggled from false to true', async () => {
      const widget = createToggleWidget(false)
      const onModelUpdate = vi.fn()
      const { user } = mountComponent(widget, false, onModelUpdate)

      await user.click(screen.getByRole('switch'))

      expect(onModelUpdate).toHaveBeenCalledWith(true)
    })

    it('emits Vue event when toggled from true to false', async () => {
      const widget = createToggleWidget(true)
      const onModelUpdate = vi.fn()
      const { user } = mountComponent(widget, true, onModelUpdate)

      await user.click(screen.getByRole('switch'))

      expect(onModelUpdate).toHaveBeenCalledWith(false)
    })

    it('handles value changes gracefully', async () => {
      const widget = createToggleWidget(false)
      const onModelUpdate = vi.fn()
      const { user } = mountComponent(widget, false, onModelUpdate)

      const toggle = screen.getByRole('switch')
      await user.click(toggle)
      await user.click(toggle)

      expect(onModelUpdate).toHaveBeenCalledTimes(2)
      expect(onModelUpdate).toHaveBeenNthCalledWith(1, true)
      expect(onModelUpdate).toHaveBeenNthCalledWith(2, false)
    })
  })

  describe('Component Rendering', () => {
    it('renders toggle switch component', () => {
      const widget = createToggleWidget(false)
      mountComponent(widget, false)

      expect(screen.getByRole('switch')).toBeDefined()
    })

    it('displays correct initial state for false', () => {
      const widget = createToggleWidget(false)
      mountComponent(widget, false)

      expect(screen.getByRole('switch')).not.toBeChecked()
    })

    it('displays correct initial state for true', () => {
      const widget = createToggleWidget(true)
      mountComponent(widget, true)

      expect(screen.getByRole('switch')).toBeChecked()
    })
  })

  describe('Multiple Value Changes', () => {
    it('handles rapid toggling correctly', async () => {
      const widget = createToggleWidget(false)
      const onModelUpdate = vi.fn()
      const { user } = mountComponent(widget, false, onModelUpdate)

      const toggle = screen.getByRole('switch')
      await user.click(toggle)
      await user.click(toggle)
      await user.click(toggle)

      expect(onModelUpdate).toHaveBeenCalledTimes(3)
      expect(onModelUpdate).toHaveBeenNthCalledWith(1, true)
      expect(onModelUpdate).toHaveBeenNthCalledWith(2, false)
      expect(onModelUpdate).toHaveBeenNthCalledWith(3, true)
    })

    it('maintains state consistency during multiple changes', async () => {
      const widget = createToggleWidget(false)
      const onModelUpdate = vi.fn()
      const { user } = mountComponent(widget, false, onModelUpdate)

      const toggle = screen.getByRole('switch')
      await user.click(toggle)
      await user.click(toggle)
      await user.click(toggle)
      await user.click(toggle)

      expect(onModelUpdate).toHaveBeenCalledTimes(4)
      expect(onModelUpdate).toHaveBeenNthCalledWith(1, true)
      expect(onModelUpdate).toHaveBeenNthCalledWith(2, false)
      expect(onModelUpdate).toHaveBeenNthCalledWith(3, true)
      expect(onModelUpdate).toHaveBeenNthCalledWith(4, false)
    })
  })

  describe('Label Display (label_on/label_off)', () => {
    it('renders ToggleGroup when labels are provided', () => {
      const widget = createToggleWidget(false, { on: 'inside', off: 'outside' })
      mountComponent(widget, false)

      expect(screen.getByRole('group')).toBeDefined()
      expect(screen.queryByRole('switch')).toBeNull()
    })

    it('renders ToggleSwitch when no labels are provided', () => {
      const widget = createToggleWidget(false, {})
      mountComponent(widget, false)

      expect(screen.getByRole('switch')).toBeDefined()
      expect(screen.queryByRole('group')).toBeNull()
    })

    it('displays both on and off labels in ToggleGroup', () => {
      const widget = createToggleWidget(false, { on: 'inside', off: 'outside' })
      mountComponent(widget, false)

      expect(screen.getByText('inside')).toBeDefined()
      expect(screen.getByText('outside')).toBeDefined()
    })

    it('selects correct option based on boolean value (false)', () => {
      const widget = createToggleWidget(false, {
        on: 'enabled',
        off: 'disabled'
      })
      mountComponent(widget, false)

      const offButton = screen.getByText('disabled')
      const onButton = screen.getByText('enabled')
      // eslint-disable-next-line testing-library/no-node-access
      expect(offButton.closest('button')).toHaveAttribute('data-state', 'on')
      // eslint-disable-next-line testing-library/no-node-access
      expect(onButton.closest('button')).toHaveAttribute('data-state', 'off')
    })

    it('selects correct option based on boolean value (true)', () => {
      const widget = createToggleWidget(true, {
        on: 'enabled',
        off: 'disabled'
      })
      mountComponent(widget, true)

      const offButton = screen.getByText('disabled')
      const onButton = screen.getByText('enabled')
      // eslint-disable-next-line testing-library/no-node-access
      expect(onButton.closest('button')).toHaveAttribute('data-state', 'on')
      // eslint-disable-next-line testing-library/no-node-access
      expect(offButton.closest('button')).toHaveAttribute('data-state', 'off')
    })

    it('emits true when "on" option is clicked', async () => {
      const widget = createToggleWidget(false, {
        on: 'enabled',
        off: 'disabled'
      })
      const onModelUpdate = vi.fn()
      const { user } = mountComponent(widget, false, onModelUpdate)

      await user.click(screen.getByText('enabled'))

      expect(onModelUpdate).toHaveBeenCalledWith(true)
    })

    it('emits false when "off" option is clicked', async () => {
      const widget = createToggleWidget(true, {
        on: 'enabled',
        off: 'disabled'
      })
      const onModelUpdate = vi.fn()
      const { user } = mountComponent(widget, true, onModelUpdate)

      await user.click(screen.getByText('disabled'))

      expect(onModelUpdate).toHaveBeenCalledWith(false)
    })

    it('falls back to i18n defaults when only partial options provided', () => {
      const widgetOnOnly = createToggleWidget(true, { on: 'active' })
      const { unmount: unmountFirst } = mountComponent(widgetOnOnly, true)
      expect(screen.getByText('active')).toBeDefined()
      expect(screen.getByText('false')).toBeDefined()
      unmountFirst()

      const widgetOffOnly = createToggleWidget(false, { off: 'inactive' })
      mountComponent(widgetOffOnly, false)
      expect(screen.getByText('inactive')).toBeDefined()
      expect(screen.getByText('true')).toBeDefined()
    })

    it('treats empty string labels as explicit values', () => {
      const widget = createToggleWidget(false, { on: '', off: 'disabled' })
      mountComponent(widget, false)

      expect(screen.getByRole('group')).toBeDefined()
      expect(screen.queryByRole('switch')).toBeNull()
      expect(screen.queryByText('true')).toBeNull()
    })

    it('disables ToggleGroup when read_only option is set', () => {
      const widget = createToggleWidget(false, {
        on: 'yes',
        off: 'no',
        read_only: true
      })
      mountComponent(widget, false)

      const buttons = screen.getAllByRole('button')
      for (const button of buttons) {
        expect(button).toBeDisabled()
      }
    })

    it('does not emit when clicking already-selected option', async () => {
      const widget = createToggleWidget(false, { on: 'yes', off: 'no' })
      const onModelUpdate = vi.fn()
      const { user } = mountComponent(widget, false, onModelUpdate)

      await user.click(screen.getByText('no'))

      expect(onModelUpdate).not.toHaveBeenCalled()
    })
  })
})
