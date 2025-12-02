import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Textarea from 'primevue/textarea'
import { describe, expect, it } from 'vitest'
import { ref, watch } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetTextarea from './WidgetTextarea.vue'

function createMockWidget(
  value: string = 'default text',
  options: SimplifiedWidget['options'] = {},
  callback?: (value: string) => void
): SimplifiedWidget<string> {
  const valueRef = ref(value)
  if (callback) watch(valueRef, (v) => callback(v))
  return {
    name: 'test_textarea',
    type: 'string',
    value: () => valueRef,
    options
  }
}

function mountComponent(
  widget: SimplifiedWidget<string>,
  modelValue: string,
  readonly = false,
  placeholder?: string
) {
  return mount(WidgetTextarea, {
    global: {
      plugins: [PrimeVue],
      components: { Textarea }
    },
    props: {
      widget,
      modelValue,
      readonly,
      placeholder
    }
  })
}

async function setTextareaValueAndTrigger(
  wrapper: ReturnType<typeof mount>,
  value: string,
  trigger: 'blur' | 'input' = 'blur'
) {
  const textarea = wrapper.find('textarea')
  if (!(textarea.element instanceof HTMLTextAreaElement)) {
    throw new Error(
      'Textarea element not found or is not an HTMLTextAreaElement'
    )
  }
  await textarea.setValue(value)
  await textarea.trigger(trigger)
  return textarea
}

describe('WidgetTextarea Value Binding', () => {
  describe('Widget Value Callbacks', () => {
    it('emits Vue event when textarea value changes on input', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('initial', {}, callback)
      const wrapper = mountComponent(widget, 'initial')

      await setTextareaValueAndTrigger(wrapper, 'new content', 'input')

      expect(callback).toHaveBeenCalledExactlyOnceWith('new content')
    })

    it('handles empty string values', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('something', {}, callback)
      const wrapper = mountComponent(widget, 'something')

      await setTextareaValueAndTrigger(wrapper, '')

      expect(callback).toHaveBeenCalledExactlyOnceWith('')
    })

    it('handles multiline text correctly', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('single line', {}, callback)
      const wrapper = mountComponent(widget, 'single line')

      const multilineText = 'Line 1\nLine 2\nLine 3'
      await setTextareaValueAndTrigger(wrapper, multilineText)

      expect(callback).toHaveBeenCalledExactlyOnceWith(multilineText)
    })

    it('handles special characters correctly', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('normal', {}, callback)
      const wrapper = mountComponent(widget, 'normal')

      const specialText = 'special @#$%^&*()[]{}|\\:";\'<>?,./'
      await setTextareaValueAndTrigger(wrapper, specialText)

      expect(callback).toHaveBeenCalledExactlyOnceWith(specialText)
    })
  })

  describe('Component Rendering', () => {
    it('renders textarea component', () => {
      const widget = createMockWidget('test value')
      const wrapper = mountComponent(widget, 'test value')

      const textarea = wrapper.find('textarea')
      expect(textarea.exists()).toBe(true)
    })

    it('displays initial value in textarea', () => {
      const widget = createMockWidget('initial content')
      const wrapper = mountComponent(widget, 'initial content')

      const textarea = wrapper.find('textarea')
      if (!(textarea.element instanceof HTMLTextAreaElement)) {
        throw new Error(
          'Textarea element not found or is not an HTMLTextAreaElement'
        )
      }
      expect(textarea.element.value).toBe('initial content')
    })

    it('uses widget name as placeholder when no placeholder provided', () => {
      const widget = createMockWidget('test')
      const wrapper = mountComponent(widget, 'test')

      const textareaLabel = wrapper.find('label')
      expect(textareaLabel.text()).toBe('test_textarea')
    })

    it('uses provided placeholder when specified', () => {
      const widget = createMockWidget('test')
      const wrapper = mountComponent(
        widget,
        'test',
        false,
        'Custom placeholder'
      )

      const textarea = wrapper.find('textarea')
      expect(textarea.attributes('placeholder')).toBe('Custom placeholder')
    })
  })

  describe('Edge Cases', () => {
    it('handles very long text', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('short', {}, callback)
      const wrapper = mountComponent(widget, 'short')

      const longText = 'a'.repeat(10000)
      await setTextareaValueAndTrigger(wrapper, longText)

      expect(callback).toHaveBeenCalledExactlyOnceWith(longText)
    })

    it('handles unicode characters', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('ascii', {}, callback)
      const wrapper = mountComponent(widget, 'ascii')

      const unicodeText = '🎨 Unicode: αβγ 中文 العربية 🚀'
      await setTextareaValueAndTrigger(wrapper, unicodeText)

      expect(callback).toHaveBeenCalledExactlyOnceWith(unicodeText)
    })

    it('handles text with tabs and spaces', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('normal', {}, callback)
      const wrapper = mountComponent(widget, 'normal')

      const formattedText = '\tIndented line\n  Spaced line\n\t\tDouble indent'
      await setTextareaValueAndTrigger(wrapper, formattedText)

      expect(callback).toHaveBeenCalledExactlyOnceWith(formattedText)
    })
  })
})
