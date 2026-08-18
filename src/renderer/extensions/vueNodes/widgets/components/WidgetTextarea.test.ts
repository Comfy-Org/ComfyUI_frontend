import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { subscribeWidgetTextInteraction } from '@/platform/nodeApi/widgetTextInteraction'
import { toNodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetTextarea from './WidgetTextarea.vue'
import { createMockWidget } from './widgetTestUtils'

const mockCopyToClipboard = vi.hoisted(() => vi.fn())
const mockIsNodeOptionsOpen = vi.hoisted(() => vi.fn(() => false))
const mockGetNodeById = vi.hoisted(() => vi.fn())

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: vi.fn(() => ({
    copyToClipboard: mockCopyToClipboard
  }))
}))

vi.mock('@/composables/graph/useMoreOptionsMenu', () => ({
  isNodeOptionsOpen: mockIsNodeOptionsOpen
}))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { graph: { getNodeById: mockGetNodeById } }
  })
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

function renderComponent(
  widget: SimplifiedWidget<string>,
  modelValue: string,
  placeholder?: string,
  onUpdateModelValue?: (...args: unknown[]) => void
) {
  return render(WidgetTextarea, {
    props: {
      widget,
      modelValue,
      nodeId: toNodeId('node-1'),
      placeholder,
      ...(onUpdateModelValue
        ? { 'onUpdate:modelValue': onUpdateModelValue }
        : {})
    },
    global: {
      mocks: {
        $t: (msg: string) => msg
      }
    }
  })
}

async function setTextareaValueAndTrigger(
  value: string,
  trigger: 'blur' | 'input' = 'blur'
) {
  const textarea = screen.getByRole('textbox')
  await fireEvent.update(textarea, value)
  if (trigger === 'blur') {
    await fireEvent.blur(textarea)
  } else {
    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.input(textarea)
  }
  return textarea
}

describe('WidgetTextarea Value Binding', () => {
  describe('Vue Event Emission', () => {
    it('emits Vue event when textarea value changes on blur', async () => {
      const widget = createTextareaWidget('hello')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'hello', undefined, onUpdateModelValue)

      await setTextareaValueAndTrigger('world', 'blur')

      expect(onUpdateModelValue).toHaveBeenCalledWith('world')
    })

    it('emits Vue event when textarea value changes on input', async () => {
      const widget = createTextareaWidget('initial')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'initial', undefined, onUpdateModelValue)

      await setTextareaValueAndTrigger('new content', 'input')

      expect(onUpdateModelValue).toHaveBeenCalledWith('new content')
    })

    it('handles empty string values', async () => {
      const widget = createTextareaWidget('something')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'something', undefined, onUpdateModelValue)

      await setTextareaValueAndTrigger('')

      expect(onUpdateModelValue).toHaveBeenCalledWith('')
    })

    it('handles multiline text correctly', async () => {
      const widget = createTextareaWidget('single line')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'single line', undefined, onUpdateModelValue)

      const multilineText = 'Line 1\nLine 2\nLine 3'
      await setTextareaValueAndTrigger(multilineText)

      expect(onUpdateModelValue).toHaveBeenCalledWith(multilineText)
    })

    it('handles special characters correctly', async () => {
      const widget = createTextareaWidget('normal')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'normal', undefined, onUpdateModelValue)

      const specialText = 'special @#$%^&*()[]{}|\\:";\'<>?,./'
      await setTextareaValueAndTrigger(specialText)

      expect(onUpdateModelValue).toHaveBeenCalledWith(specialText)
    })

    it('handles missing callback gracefully', async () => {
      const widget = createTextareaWidget('test', {}, undefined)
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'test', undefined, onUpdateModelValue)

      await setTextareaValueAndTrigger('new value')

      expect(onUpdateModelValue).toHaveBeenCalledWith('new value')
    })
  })

  describe('User Interactions', () => {
    it('emits update:modelValue on blur', async () => {
      const widget = createTextareaWidget('original')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'original', undefined, onUpdateModelValue)

      await setTextareaValueAndTrigger('updated')

      expect(onUpdateModelValue).toHaveBeenCalledWith('updated')
    })

    it('emits update:modelValue on input', async () => {
      const widget = createTextareaWidget('start')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'start', undefined, onUpdateModelValue)

      await setTextareaValueAndTrigger('finish', 'input')

      expect(onUpdateModelValue).toHaveBeenCalledWith('finish')
    })
  })

  describe('Component Rendering', () => {
    it('renders textarea component', () => {
      const widget = createTextareaWidget('test value')
      renderComponent(widget, 'test value')

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('displays initial value in textarea', () => {
      const widget = createTextareaWidget('initial content')
      renderComponent(widget, 'initial content')

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe('initial content')
    })

    it('uses widget name as placeholder when no placeholder provided', () => {
      const widget = createTextareaWidget('test')
      const { container } = renderComponent(widget, 'test')

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const textareaLabel = container.querySelector('label')
      expect(textareaLabel?.textContent).toBe('test_textarea')
    })

    it('uses provided placeholder when specified', () => {
      const widget = createTextareaWidget('test')
      renderComponent(widget, 'test', 'Custom placeholder')

      const textarea = screen.getByRole('textbox')
      expect(textarea.getAttribute('placeholder')).toBe('Custom placeholder')
    })
  })
  describe('Copy Button Behavior', () => {
    it('hides copy button when not read-only', async () => {
      const widget = createTextareaWidget('test')
      renderComponent(widget, 'test')

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('copy button has invisible class by default when read-only', () => {
      const widget = createTextareaWidget('test', { read_only: true })
      renderComponent(widget, 'test')

      const button = screen.getByRole('button')
      expect(button.classList.contains('invisible')).toBe(true)
    })

    it('copy button has group-hover:visible class when read-only, and copies on click', async () => {
      const widget = createTextareaWidget('test value', { read_only: true })
      renderComponent(widget, 'test value')

      const button = screen.getByRole('button')
      expect(button.classList.contains('group-hover:visible')).toBe(true)

      await userEvent.click(button)

      expect(mockCopyToClipboard).toHaveBeenCalledWith('test value')
    })
  })

  describe('Locked Field Hover Styling', () => {
    // Tests assert on the Tailwind class name directly because that's the
    // mechanism being guarded — a rename would need a baseline update anyway.
    const HOVER_CLASS = 'hover:bg-component-node-widget-background-hovered'

    it('omits the generic hover background class from the wrapper when read-only', () => {
      const widget = createTextareaWidget('locked value', {
        read_only: true
      })
      const { container } = renderComponent(widget, 'locked value')

      // hover class lives on wrapper <div>, not the <textarea>
      // eslint-disable-next-line testing-library/no-node-access
      const wrapper = container.firstElementChild
      expect(wrapper?.className).not.toContain(HOVER_CLASS)
    })

    it('omits the generic hover background class from the wrapper when disabled', () => {
      const widget = createTextareaWidget('linked value', { disabled: true })
      const { container } = renderComponent(widget, 'linked value')

      // hover class lives on wrapper <div>, not the <textarea>
      // eslint-disable-next-line testing-library/no-node-access
      const wrapper = container.firstElementChild
      expect(wrapper?.className).not.toContain(HOVER_CLASS)
    })

    it('applies the generic hover background class to the wrapper when editable', () => {
      const widget = createTextareaWidget('editable value')
      const { container } = renderComponent(widget, 'editable value')

      // hover class lives on wrapper <div>, not the <textarea>
      // eslint-disable-next-line testing-library/no-node-access
      const wrapper = container.firstElementChild
      expect(wrapper?.className).toContain(HOVER_CLASS)
    })
  })

  describe('Edge Cases', () => {
    it('handles very long text', async () => {
      const widget = createTextareaWidget('short')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'short', undefined, onUpdateModelValue)

      const longText = 'a'.repeat(10000)
      await setTextareaValueAndTrigger(longText)

      expect(onUpdateModelValue).toHaveBeenCalledWith(longText)
    })

    it('handles unicode characters', async () => {
      const widget = createTextareaWidget('ascii')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'ascii', undefined, onUpdateModelValue)

      const unicodeText = '🎨 Unicode: αβγ 中文 العربية 🚀'
      await setTextareaValueAndTrigger(unicodeText)

      expect(onUpdateModelValue).toHaveBeenCalledWith(unicodeText)
    })

    it('handles text with tabs and spaces', async () => {
      const widget = createTextareaWidget('normal')
      const onUpdateModelValue = vi.fn()
      renderComponent(widget, 'normal', undefined, onUpdateModelValue)

      const formattedText = '\tIndented line\n  Spaced line\n\t\tDouble indent'
      await setTextareaValueAndTrigger(formattedText)

      expect(onUpdateModelValue).toHaveBeenCalledWith(formattedText)
    })
  })
})

describe('WidgetTextarea contextmenu', () => {
  it('prevents browser menu on first right-click (menu closed)', () => {
    mockIsNodeOptionsOpen.mockReturnValue(false)
    const widget = createTextareaWidget('test')
    renderComponent(widget, 'test')
    const textarea = screen.getByRole('textbox')

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation')

    textarea.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(stopPropagationSpy).not.toHaveBeenCalled()
  })

  it('allows browser menu on second right-click (menu open)', () => {
    mockIsNodeOptionsOpen.mockReturnValue(true)
    const widget = createTextareaWidget('test')
    renderComponent(widget, 'test')
    const textarea = screen.getByRole('textbox')

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation')

    textarea.dispatchEvent(event)

    expect(preventDefaultSpy).not.toHaveBeenCalled()
    expect(stopPropagationSpy).toHaveBeenCalled()
  })
})

describe('WidgetTextarea text interactions', () => {
  it('publishes the caret and applies a contributed edit', async () => {
    const raw: IBaseWidget = {
      name: 'test_textarea',
      type: 'customtext',
      value: 'embedding:foo',
      y: 0,
      options: {}
    }
    mockGetNodeById.mockReturnValue({ widgets: [raw] })
    const commit = vi.fn((value) => {
      raw.value = value
    })
    const listener = vi.fn((event) => {
      if (event.kind === 'input') {
        event.setValue('embedding:bar', { start: 13, end: 13 })
      }
    })
    subscribeWidgetTextInteraction(raw, listener, commit)
    renderComponent(createTextareaWidget(), 'embedding:foo')
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    await userEvent.type(textarea, 'x', {
      initialSelectionStart: 9,
      initialSelectionEnd: 12
    })

    const inputEvent = listener.mock.calls.find(
      ([event]) => event.kind === 'input'
    )?.[0]
    expect(inputEvent?.selection).toEqual({ start: 10, end: 10 })
    expect(commit).toHaveBeenCalledWith('embedding:bar')
    expect(textarea.value).toBe('embedding:bar')
    expect(textarea.selectionStart).toBe(13)
    expect(textarea.selectionEnd).toBe(13)
  })

  it('publishes keyboard gestures from the Vue textarea', async () => {
    const raw: IBaseWidget = {
      name: 'test_textarea',
      type: 'customtext',
      value: '<lora:foo:1.0>',
      y: 0,
      options: {}
    }
    mockGetNodeById.mockReturnValue({ widgets: [raw] })
    const listener = vi.fn()
    subscribeWidgetTextInteraction(raw, listener, vi.fn())
    renderComponent(createTextareaWidget(), '<lora:foo:1.0>')

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.keyboard('{Control>}{Shift>}{ArrowUp}{/Shift}{/Control}')

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'keydown',
        key: 'ArrowUp',
        ctrlKey: true,
        shiftKey: true
      })
    )
  })
})
