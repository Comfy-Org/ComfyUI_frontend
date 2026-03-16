import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetTextarea from './WidgetTextarea.vue'
import { createMockWidget } from './widgetTestUtils'

const mockCopyToClipboard = vi.hoisted(() => vi.fn())
const mockIsNodeOptionsOpen = vi.hoisted(() => vi.fn(() => false))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: vi.fn().mockReturnValue({
    copyToClipboard: mockCopyToClipboard
  })
}))

vi.mock('@/composables/graph/useMoreOptionsMenu', () => ({
  isNodeOptionsOpen: mockIsNodeOptionsOpen
}))

function createTextareaWidget(
  value: string = 'default text',
  options: SimplifiedWidget<string>['options'] = {},
  callback?: (value: string) => void
) {
  return createMockWidget<string>({
    value,
    name: 'test_textarea',
    options,
    callback
  })
}

function mountComponent(
  widget: SimplifiedWidget<string>,
  modelValue: string,
  readonly = false,
  placeholder?: string
) {
  return mount(WidgetTextarea, {
    props: {
      widget,
      modelValue,
      readonly,
      placeholder
    },
    global: {
      mocks: {
        $t: (msg: string) => msg
      }
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
  describe('Vue Event Emission', () => {
    it('emits Vue event when textarea value changes on blur', async () => {
      const widget = createTextareaWidget('hello')
      const wrapper = mountComponent(widget, 'hello')

      await setTextareaValueAndTrigger(wrapper, 'world', 'blur')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted?.[0]).toContain('world')
    })

    it('emits Vue event when textarea value changes on input', async () => {
      const widget = createTextareaWidget('initial')
      const wrapper = mountComponent(widget, 'initial')

      await setTextareaValueAndTrigger(wrapper, 'new content', 'input')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted?.[0]).toContain('new content')
    })

    it('handles empty string values', async () => {
      const widget = createTextareaWidget('something')
      const wrapper = mountComponent(widget, 'something')

      await setTextareaValueAndTrigger(wrapper, '')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted?.[0]).toContain('')
    })

    it('handles multiline text correctly', async () => {
      const widget = createTextareaWidget('single line')
      const wrapper = mountComponent(widget, 'single line')

      const multilineText = 'Line 1\nLine 2\nLine 3'
      await setTextareaValueAndTrigger(wrapper, multilineText)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted?.[0]).toContain(multilineText)
    })

    it('handles special characters correctly', async () => {
      const widget = createTextareaWidget('normal')
      const wrapper = mountComponent(widget, 'normal')

      const specialText = 'special @#$%^&*()[]{}|\\:";\'<>?,./'
      await setTextareaValueAndTrigger(wrapper, specialText)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted?.[0]).toContain(specialText)
    })

    it('handles missing callback gracefully', async () => {
      const widget = createTextareaWidget('test', {}, undefined)
      const wrapper = mountComponent(widget, 'test')

      await setTextareaValueAndTrigger(wrapper, 'new value')

      // Should still emit Vue event
      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted?.[0]).toContain('new value')
    })
  })

  describe('User Interactions', () => {
    it('emits update:modelValue on blur', async () => {
      const widget = createTextareaWidget('original')
      const wrapper = mountComponent(widget, 'original')

      await setTextareaValueAndTrigger(wrapper, 'updated')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted?.[0]).toContain('updated')
    })

    it('emits update:modelValue on input', async () => {
      const widget = createTextareaWidget('start')
      const wrapper = mountComponent(widget, 'start')

      await setTextareaValueAndTrigger(wrapper, 'finish', 'input')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted?.[0]).toContain('finish')
    })
  })

  describe('Component Rendering', () => {
    it('renders textarea component', () => {
      const widget = createTextareaWidget('test value')
      const wrapper = mountComponent(widget, 'test value')

      const textarea = wrapper.find('textarea')
      expect(textarea.exists()).toBe(true)
    })

    it('displays initial value in textarea', () => {
      const widget = createTextareaWidget('initial content')
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
      const widget = createTextareaWidget('test')
      const wrapper = mountComponent(widget, 'test')

      const textareaLabel = wrapper.find('label')
      expect(textareaLabel.text()).toBe('test_textarea')
    })

    it('uses provided placeholder when specified', () => {
      const widget = createTextareaWidget('test')
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
  describe('Copy Button Behavior', () => {
    beforeEach(() => {
      mockCopyToClipboard.mockClear()
    })

    it('hides copy button when not read-only', async () => {
      const widget = createTextareaWidget('test')
      const wrapper = mountComponent(widget, 'test', false)

      const button = wrapper.find('button')
      expect(button.exists()).toBe(false)
    })

    it('copy button has invisible class by default when read-only', () => {
      const widget = createTextareaWidget('test', { read_only: true })
      const wrapper = mountComponent(widget, 'test', true)

      const button = wrapper.find('button')
      expect(button.exists()).toBe(true)
      expect(button.classes()).toContain('invisible')
    })

    it('copy button has group-hover:visible class when read-only, and copies on click', async () => {
      const widget = createTextareaWidget('test value', { read_only: true })
      const wrapper = mountComponent(widget, 'test value', true)

      const button = wrapper.find('button')
      expect(button.exists()).toBe(true)
      expect(button.classes()).toContain('group-hover:visible')

      await button.trigger('click')

      expect(mockCopyToClipboard).toHaveBeenCalledWith('test value')
    })
  })

  describe('Edge Cases', () => {
    it('handles very long text', async () => {
      const widget = createTextareaWidget('short')
      const wrapper = mountComponent(widget, 'short')

      const longText = 'a'.repeat(10000)
      await setTextareaValueAndTrigger(wrapper, longText)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted?.[0]).toContain(longText)
    })

    it('handles unicode characters', async () => {
      const widget = createTextareaWidget('ascii')
      const wrapper = mountComponent(widget, 'ascii')

      const unicodeText = '🎨 Unicode: αβγ 中文 العربية 🚀'
      await setTextareaValueAndTrigger(wrapper, unicodeText)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted?.[0]).toContain(unicodeText)
    })

    it('handles text with tabs and spaces', async () => {
      const widget = createTextareaWidget('normal')
      const wrapper = mountComponent(widget, 'normal')

      const formattedText = '\tIndented line\n  Spaced line\n\t\tDouble indent'
      await setTextareaValueAndTrigger(wrapper, formattedText)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted?.[0]).toContain(formattedText)
    })
  })
})

describe('WidgetTextarea contextmenu', () => {
  it('prevents browser menu on first right-click (menu closed)', () => {
    mockIsNodeOptionsOpen.mockReturnValue(false)
    const widget = createTextareaWidget('test')
    const wrapper = mountComponent(widget, 'test')
    const textarea = wrapper.find('textarea')

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation')

    textarea.element.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(stopPropagationSpy).not.toHaveBeenCalled()
  })

  it('allows browser menu on second right-click (menu open)', () => {
    mockIsNodeOptionsOpen.mockReturnValue(true)
    const widget = createTextareaWidget('test')
    const wrapper = mountComponent(widget, 'test')
    const textarea = wrapper.find('textarea')

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation')

    textarea.element.dispatchEvent(event)

    expect(preventDefaultSpy).not.toHaveBeenCalled()
    expect(stopPropagationSpy).toHaveBeenCalled()
  })
})
