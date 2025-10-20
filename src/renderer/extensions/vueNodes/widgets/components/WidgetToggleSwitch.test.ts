import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ToggleSwitch from 'primevue/toggleswitch'
import type { ToggleSwitchProps } from 'primevue/toggleswitch'
import { describe, expect, it } from 'vitest'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetToggleSwitch from './WidgetToggleSwitch.vue'

describe('WidgetToggleSwitch Value Binding', () => {
  const createMockWidget = (
    value: boolean = false,
    options: Partial<ToggleSwitchProps> = {},
    callback?: (value: boolean) => void
  ): SimplifiedWidget<boolean> => ({
    name: 'test_toggle',
    type: 'boolean',
    value,
    options,
    callback
  })

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

  describe('Vue Event Emission', () => {
    it('emits Vue event when toggled from false to true', async () => {
      const widget = createMockWidget(false)
      const wrapper = mountComponent(widget, false)

      const toggle = wrapper.findComponent({ name: 'ToggleSwitch' })
      await toggle.setValue(true)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain(true)
    })

    it('emits Vue event when toggled from true to false', async () => {
      const widget = createMockWidget(true)
      const wrapper = mountComponent(widget, true)

      const toggle = wrapper.findComponent({ name: 'ToggleSwitch' })
      await toggle.setValue(false)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain(false)
    })

    it('handles value changes gracefully', async () => {
      const widget = createMockWidget(false)
      const wrapper = mountComponent(widget, false)

      // Should not throw when changing values
      const toggle = wrapper.findComponent({ name: 'ToggleSwitch' })
      await toggle.setValue(true)
      await toggle.setValue(false)

      // Should emit events for all changes
      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toHaveLength(2)
      expect(emitted![0]).toContain(true)
      expect(emitted![1]).toContain(false)
    })
  })

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
    it('handles rapid toggling correctly', async () => {
      const widget = createMockWidget(false)
      const wrapper = mountComponent(widget, false)

      const toggle = wrapper.findComponent({ name: 'ToggleSwitch' })

      // Rapid toggle sequence
      await toggle.setValue(true)
      await toggle.setValue(false)
      await toggle.setValue(true)

      // Should have emitted 3 Vue events with correct values
      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toHaveLength(3)
      expect(emitted![0]).toContain(true)
      expect(emitted![1]).toContain(false)
      expect(emitted![2]).toContain(true)
    })

    it('maintains state consistency during multiple changes', async () => {
      const widget = createMockWidget(false)
      const wrapper = mountComponent(widget, false)

      const toggle = wrapper.findComponent({ name: 'ToggleSwitch' })

      // Multiple state changes
      await toggle.setValue(true)
      await toggle.setValue(false)
      await toggle.setValue(true)
      await toggle.setValue(false)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toHaveLength(4)
      // Verify alternating pattern
      expect(emitted![0]).toContain(true)
      expect(emitted![1]).toContain(false)
      expect(emitted![2]).toContain(true)
      expect(emitted![3]).toContain(false)
    })
  })
})
