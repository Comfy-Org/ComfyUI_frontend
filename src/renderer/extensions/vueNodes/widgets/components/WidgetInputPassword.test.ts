import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputPassword from './WidgetInputPassword.vue'

describe('WidgetInputPassword', () => {
  const createMockWidget = (value: string = ''): SimplifiedWidget<string> => ({
    name: 'api_key',
    type: 'password',
    value,
    options: {} as IWidgetOptions
  })

  const mountComponent = (
    widget: SimplifiedWidget<string>,
    modelValue: string
  ) => {
    return mount(WidgetInputPassword, {
      props: {
        widget,
        modelValue
      }
    })
  }

  describe('Component Rendering', () => {
    it('renders a password input', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, '')

      const input = wrapper.find('input[type="password"]')
      expect(input.exists()).toBe(true)
    })

    it('has autocomplete="off"', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, '')

      const input = wrapper.find('input[type="password"]')
      expect(input.attributes('autocomplete')).toBe('off')
    })

    it('has correct aria-label', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, '')

      const input = wrapper.find('input[type="password"]')
      expect(input.attributes('aria-label')).toBe('api_key')
    })

    it('does not render a text input', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, '')

      const textInput = wrapper.find('input[type="text"]')
      expect(textInput.exists()).toBe(false)
    })
  })

  describe('Value Binding', () => {
    it('emits update:modelValue on input', async () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, '')

      const input = wrapper.find('input[type="password"]')
      await input.setValue('sk-abc123')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('sk-abc123')
    })

    it('handles special characters in API keys', async () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, '')

      const apiKey = 'sk-abc123_XYZ!@#$%^&*()'
      const input = wrapper.find('input[type="password"]')
      await input.setValue(apiKey)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain(apiKey)
    })

    it('handles empty string values', async () => {
      const widget = createMockWidget('existing-key')
      const wrapper = mountComponent(widget, 'existing-key')

      const input = wrapper.find('input[type="password"]')
      await input.setValue('')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('')
    })
  })
})
