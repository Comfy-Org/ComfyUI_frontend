import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ToggleSwitch from 'primevue/toggleswitch'
import type { ToggleSwitchProps } from 'primevue/toggleswitch'
import { describe, expect, it } from 'vitest'
import { ref, watch } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetToggleSwitch from './WidgetToggleSwitch.vue'

describe('WidgetToggleSwitch Value Binding', () => {
  const createMockWidget = (
    value: boolean = false,
    options: Partial<ToggleSwitchProps> = {},
    callback?: (value: boolean) => void
  ): SimplifiedWidget<boolean> => {
    const valueRef = ref(value)
    if (callback) watch(valueRef, (v) => callback(v))
    return {
      name: 'test_toggle',
      type: 'boolean',
      value: () => valueRef,
      options
    }
  }

  const mountComponent = (
    widget: SimplifiedWidget<boolean>,
    modelValue: boolean,
    readonly = false
  ) => {
    return mount(WidgetToggleSwitch, {
      props: {
        widget,
        modelValue,
        readonly
      },
      global: {
        plugins: [PrimeVue],
        components: { ToggleSwitch }
      }
    })
  }

  describe('Component Rendering', () => {
    it('renders toggle switch component', () => {
      const widget = createMockWidget(false)
      const wrapper = mountComponent(widget, false)

      expect(wrapper.findComponent({ name: 'ToggleSwitch' }).exists()).toBe(
        true
      )
    })

    it('displays correct initial state for false', () => {
      const widget = createMockWidget(false)
      const wrapper = mountComponent(widget, false)

      const toggle = wrapper.findComponent({ name: 'ToggleSwitch' })
      expect(toggle.props('modelValue')).toBe(false)
    })

    it('displays correct initial state for true', () => {
      const widget = createMockWidget(true)
      const wrapper = mountComponent(widget, true)

      const toggle = wrapper.findComponent({ name: 'ToggleSwitch' })
      expect(toggle.props('modelValue')).toBe(true)
    })
  })

  describe('Multiple Value Changes', () => {
    it('maintains state consistency during multiple changes', async () => {
      const callback = vi.fn()
      const widget = createMockWidget(false, {}, callback)
      const wrapper = mountComponent(widget, false)

      const toggle = wrapper.findComponent({ name: 'ToggleSwitch' })

      // Multiple state changes
      await toggle.setValue(true)
      await toggle.setValue(false)
      await toggle.setValue(true)
      await toggle.setValue(false)

      expect(callback).toHaveBeenCalledTimes(4)
      // Verify alternating pattern
      expect(callback).toHaveBeenNthCalledWith(1, true)
      expect(callback).toHaveBeenNthCalledWith(2, false)
      expect(callback).toHaveBeenNthCalledWith(3, true)
      expect(callback).toHaveBeenNthCalledWith(4, false)
    })
  })
})
