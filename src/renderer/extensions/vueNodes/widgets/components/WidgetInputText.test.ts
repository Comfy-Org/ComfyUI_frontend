/* eslint-disable testing-library/no-container, testing-library/no-node-access */
/* eslint-disable testing-library/prefer-user-event */
import { fireEvent, render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import type { InputTextProps } from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { describe, expect, it, vi } from 'vitest'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputText from './WidgetInputText.vue'
import { createMockWidget } from './widgetTestUtils'

describe('WidgetInputText Value Binding', () => {
  const createInputTextWidget = (
    value: string = 'default',
    options: Partial<InputTextProps> & IWidgetOptions = {},
    callback?: (value: string) => void
  ) =>
    createMockWidget<string>({
      value,
      name: 'test_input',
      options,
      callback
    })

  const renderComponent = (
    widget: SimplifiedWidget<string>,
    modelValue: string,
    _readonly = false,
    extraProps: Record<string, unknown> = {}
  ) => {
    return render(WidgetInputText, {
      global: {
        plugins: [PrimeVue],
        components: { InputText, Textarea }
      },
      props: {
        widget,
        modelValue,
        ...extraProps
      }
    })
  }

  const setInputValueAndTrigger = async (
    input: HTMLElement,
    value: string,
    trigger: 'blur' | 'enter' = 'blur'
  ) => {
    await fireEvent.update(input, value)
    if (trigger === 'blur') {
      await fireEvent.blur(input)
    } else {
      await fireEvent.keyDown(input, { key: 'Enter' })
    }
    return input
  }

  describe('Vue Event Emission', () => {
    it('emits Vue event when input value changes on blur', async () => {
      const widget = createInputTextWidget('hello')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'hello', false, {
        'onUpdate:modelValue': onUpdateModelValue
      })

      const input = screen.getByRole('textbox')
      await setInputValueAndTrigger(input, 'world', 'blur')

      expect(onUpdateModelValue).toHaveBeenCalledWith('world')
    })

    it('emits Vue event when enter key is pressed', async () => {
      const widget = createInputTextWidget('initial')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'initial', false, {
        'onUpdate:modelValue': onUpdateModelValue
      })

      const input = screen.getByRole('textbox')
      await setInputValueAndTrigger(input, 'new value', 'enter')

      expect(onUpdateModelValue).toHaveBeenCalledWith('new value')
    })

    it('handles empty string values', async () => {
      const widget = createInputTextWidget('something')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'something', false, {
        'onUpdate:modelValue': onUpdateModelValue
      })

      const input = screen.getByRole('textbox')
      await setInputValueAndTrigger(input, '')

      expect(onUpdateModelValue).toHaveBeenCalledWith('')
    })

    it('handles special characters correctly', async () => {
      const widget = createInputTextWidget('normal')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'normal', false, {
        'onUpdate:modelValue': onUpdateModelValue
      })

      const specialText = 'special @#$%^&*()[]{}|\\:";\'<>?,./'
      const input = screen.getByRole('textbox')
      await setInputValueAndTrigger(input, specialText)

      expect(onUpdateModelValue).toHaveBeenCalledWith(specialText)
    })

    it('handles missing callback gracefully', async () => {
      const widget = createInputTextWidget('test', {}, undefined)
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'test', false, {
        'onUpdate:modelValue': onUpdateModelValue
      })

      const input = screen.getByRole('textbox')
      await setInputValueAndTrigger(input, 'new value')

      // Should still emit Vue event
      expect(onUpdateModelValue).toHaveBeenCalledWith('new value')
    })
  })

  describe('User Interactions', () => {
    it('emits update:modelValue on blur', async () => {
      const widget = createInputTextWidget('original')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'original', false, {
        'onUpdate:modelValue': onUpdateModelValue
      })

      const input = screen.getByRole('textbox')
      await setInputValueAndTrigger(input, 'updated')

      expect(onUpdateModelValue).toHaveBeenCalledWith('updated')
    })

    it('emits update:modelValue on enter key', async () => {
      const widget = createInputTextWidget('start')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'start', false, {
        'onUpdate:modelValue': onUpdateModelValue
      })

      const input = screen.getByRole('textbox')
      await setInputValueAndTrigger(input, 'finish', 'enter')

      expect(onUpdateModelValue).toHaveBeenCalledWith('finish')
    })
  })

  describe('Component Rendering', () => {
    it('always renders InputText component', () => {
      const widget = createInputTextWidget('test value')
      const { container } = renderComponent(widget, 'test value')

      // WidgetInputText always uses InputText, not Textarea
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()

      // Should not render textarea (that's handled by WidgetTextarea component)
      const textarea = container.querySelector('textarea')
      expect(textarea).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles very long strings', async () => {
      const widget = createInputTextWidget('short')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'short', false, {
        'onUpdate:modelValue': onUpdateModelValue
      })

      const longString = 'a'.repeat(10000)
      const input = screen.getByRole('textbox')
      await setInputValueAndTrigger(input, longString)

      expect(onUpdateModelValue).toHaveBeenCalledWith(longString)
    })

    it('handles unicode characters', async () => {
      const widget = createInputTextWidget('ascii')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'ascii', false, {
        'onUpdate:modelValue': onUpdateModelValue
      })

      const unicodeText = '🎨 Unicode: αβγ 中文 العربية 🚀'
      const input = screen.getByRole('textbox')
      await setInputValueAndTrigger(input, unicodeText)

      expect(onUpdateModelValue).toHaveBeenCalledWith(unicodeText)
    })
  })
})
