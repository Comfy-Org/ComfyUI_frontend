import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import type { InputTextProps } from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { describe, expect, it } from 'vitest'
import { ref, watch } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputText from './WidgetInputText.vue'

describe('WidgetInputText Value Binding', () => {
  const createMockWidget = (
    value: string = 'default',
    options: Partial<InputTextProps> = {},
    callback?: (value: string) => void
  ): SimplifiedWidget<string> => {
    const valueRef = ref(value)
    if (callback) watch(valueRef, (v) => callback(v))
    return {
      name: 'test_input',
      type: 'string',
      value: () => valueRef,
      options
    }
  }

  const mountComponent = (
    widget: SimplifiedWidget<string>,
    modelValue: string,
    readonly = false
  ) => {
    return mount(WidgetInputText, {
      global: {
        plugins: [PrimeVue],
        components: { InputText, Textarea }
      },
      props: {
        widget,
        modelValue,
        readonly
      }
    })
  }

  const setInputValueAndTrigger = async (
    wrapper: ReturnType<typeof mount>,
    value: string,
    trigger: 'blur' | 'keydown.enter' = 'blur'
  ) => {
    const input = wrapper.find('input[type="text"]')
    if (!(input.element instanceof HTMLInputElement)) {
      throw new Error('Input element not found or is not an HTMLInputElement')
    }
    await input.setValue(value)
    await input.trigger(trigger)
    return input
  }

  describe('Widget Value Callbacks', () => {
    it('handles empty string values', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('something', {}, callback)
      const wrapper = mountComponent(widget, 'something')

      await setInputValueAndTrigger(wrapper, '')

      expect(callback).toHaveBeenCalledExactlyOnceWith('')
    })

    it('handles special characters correctly', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('normal', {}, callback)
      const wrapper = mountComponent(widget, 'normal')

      const specialText = 'special @#$%^&*()[]{}|\\:";\'<>?,./'
      await setInputValueAndTrigger(wrapper, specialText)

      expect(callback).toHaveBeenCalledExactlyOnceWith(specialText)
    })
  })

  describe('Component Rendering', () => {
    it('always renders InputText component', () => {
      const widget = createMockWidget('test value')
      const wrapper = mountComponent(widget, 'test value')

      // WidgetInputText always uses InputText, not Textarea
      const input = wrapper.find('input[type="text"]')
      expect(input.exists()).toBe(true)

      // Should not render textarea (that's handled by WidgetTextarea component)
      const textarea = wrapper.find('textarea')
      expect(textarea.exists()).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('handles very long strings', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('short', {}, callback)
      const wrapper = mountComponent(widget, 'short')

      const longString = 'a'.repeat(10000)
      await setInputValueAndTrigger(wrapper, longString)

      expect(callback).toHaveBeenCalledExactlyOnceWith(longString)
    })

    it('handles unicode characters', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('ascii', {}, callback)
      const wrapper = mountComponent(widget, 'ascii')

      const unicodeText = '🎨 Unicode: αβγ 中文 العربية 🚀'
      await setInputValueAndTrigger(wrapper, unicodeText)

      expect(callback).toHaveBeenCalledExactlyOnceWith(unicodeText)
    })
  })
})
