import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import type { InputTextProps } from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { describe, expect, it } from 'vitest'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputText from './WidgetInputText.vue'

describe('WidgetInputText Value Binding', () => {
  const createMockWidget = (
    value: string = 'default',
    options: Partial<InputTextProps> = {},
    callback?: (value: string) => void
  ): SimplifiedWidget<string> => ({
    name: 'test_input',
    type: 'string',
    value,
    options,
    callback
  })

  describe('Vue Event Emission', () => {
    it('emits Vue event when input value changes on blur', async () => {
      const widget = createMockWidget('hello')

      const wrapper = mount(WidgetInputText, {
        global: {
          plugins: [PrimeVue],
          components: { InputText, Textarea }
        },
        props: {
          widget,
          modelValue: 'hello',
          readonly: false
        }
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('world')
      await input.trigger('blur')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('world')
    })

    it('emits Vue event when enter key is pressed', async () => {
      const widget = createMockWidget('initial')

      const wrapper = mount(WidgetInputText, {
        global: {
          plugins: [PrimeVue],
          components: { InputText, Textarea }
        },
        props: {
          widget,
          modelValue: 'initial',
          readonly: false
        }
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('new value')
      await input.trigger('keydown.enter')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('new value')
    })

    it('handles empty string values', async () => {
      const widget = createMockWidget('something')

      const wrapper = mount(WidgetInputText, {
        global: {
          plugins: [PrimeVue],
          components: { InputText, Textarea }
        },
        props: {
          widget,
          modelValue: 'something',
          readonly: false
        }
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('')
      await input.trigger('blur')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('')
    })

    it('handles special characters correctly', async () => {
      const widget = createMockWidget('normal')

      const wrapper = mount(WidgetInputText, {
        global: {
          plugins: [PrimeVue],
          components: { InputText, Textarea }
        },
        props: {
          widget,
          modelValue: 'normal',
          readonly: false
        }
      })

      const specialText = 'special @#$%^&*()[]{}|\\:";\'<>?,./'
      const input = wrapper.find('input[type="text"]')
      await input.setValue(specialText)
      await input.trigger('blur')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain(specialText)
    })

    it('handles missing callback gracefully', async () => {
      const widget = createMockWidget('test', {}, undefined)

      const wrapper = mount(WidgetInputText, {
        global: {
          plugins: [PrimeVue],
          components: { InputText, Textarea }
        },
        props: {
          widget,
          modelValue: 'test',
          readonly: false
        }
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('new value')
      await input.trigger('blur')

      // Should still emit Vue event
      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('new value')
    })
  })

  describe('User Interactions', () => {
    it('emits update:modelValue on blur', async () => {
      const widget = createMockWidget('original')

      const wrapper = mount(WidgetInputText, {
        global: {
          plugins: [PrimeVue],
          components: { InputText, Textarea }
        },
        props: {
          widget,
          modelValue: 'original',
          readonly: false
        }
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('updated')
      await input.trigger('blur')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('updated')
    })

    it('emits update:modelValue on enter key', async () => {
      const widget = createMockWidget('start')

      const wrapper = mount(WidgetInputText, {
        global: {
          plugins: [PrimeVue],
          components: { InputText, Textarea }
        },
        props: {
          widget,
          modelValue: 'start',
          readonly: false
        }
      })

      const input = wrapper.find('input[type="text"]')
      await input.setValue('finish')
      await input.trigger('keydown.enter')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('finish')
    })
  })

  describe('Readonly Mode', () => {
    it('disables input when readonly', () => {
      const widget = createMockWidget('readonly test')

      const wrapper = mount(WidgetInputText, {
        global: {
          plugins: [PrimeVue],
          components: { InputText, Textarea }
        },
        props: {
          widget,
          modelValue: 'readonly test',
          readonly: true
        }
      })

      const input = wrapper.find('input[type="text"]')
      expect((input.element as HTMLInputElement).disabled).toBe(true)
    })
  })

  describe('Component Rendering', () => {
    it('always renders InputText component', () => {
      const widget = createMockWidget('test value')

      const wrapper = mount(WidgetInputText, {
        global: {
          plugins: [PrimeVue],
          components: { InputText, Textarea }
        },
        props: {
          widget,
          modelValue: 'test value',
          readonly: false
        }
      })

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
      const widget = createMockWidget('short')

      const wrapper = mount(WidgetInputText, {
        global: {
          plugins: [PrimeVue],
          components: { InputText, Textarea }
        },
        props: {
          widget,
          modelValue: 'short',
          readonly: false
        }
      })

      const longString = 'a'.repeat(10000)
      const input = wrapper.find('input[type="text"]')
      await input.setValue(longString)
      await input.trigger('blur')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain(longString)
    })

    it('handles unicode characters', async () => {
      const widget = createMockWidget('ascii')

      const wrapper = mount(WidgetInputText, {
        global: {
          plugins: [PrimeVue],
          components: { InputText, Textarea }
        },
        props: {
          widget,
          modelValue: 'ascii',
          readonly: false
        }
      })

      const unicodeText = '🎨 Unicode: αβγ 中文 العربية 🚀'
      const input = wrapper.find('input[type="text"]')
      await input.setValue(unicodeText)
      await input.trigger('blur')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain(unicodeText)
    })
  })
})
