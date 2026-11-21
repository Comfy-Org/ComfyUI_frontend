import { toNodeId } from '@comfyorg/graph-model/nodeId'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { i18n } from '@/i18n'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetTextarea from './WidgetTextarea.vue'
import { createMockWidget } from './widgetTestUtils'

const mockCopyToClipboard = vi.hoisted(() => vi.fn())
const mockIsNodeOptionsOpen = vi.hoisted(() => vi.fn(() => false))

vi.mock(import('@/composables/useCopyToClipboard'), () => ({
  useCopyToClipboard: vi.fn(() => ({
    copyToClipboard: mockCopyToClipboard
  }))
}))

vi.mock(import('@/composables/graph/useMoreOptionsMenu'), () => ({
  isNodeOptionsOpen: mockIsNodeOptionsOpen
}))

function createTextareaWidget(
  value: string = 'default text',
  options: SimplifiedWidget<string>['options'] = {},
  callback?: (value: string) => void
) {
  return createMockWidget({
    value,
    name: 'test_textarea',
    options,
    callback
  })
}

function renderComponent(
  widget: SimplifiedWidget<string>,
  modelValue: string | number | null,
  placeholder?: string,
  onUpdateModelValue?: (...args: unknown[]) => void
) {
  return render(WidgetTextarea, {
    props: {
      widget,
      modelValue,
      placeholder,
      ...(onUpdateModelValue
        ? { 'onUpdate:modelValue': onUpdateModelValue }
        : {})
    },
    global: {
      plugins: [i18n],
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
    // oxlint-disable-next-line testing-library/prefer-user-event
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

      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access
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
    it.for([
      { state: 'editable', options: {} },
      { state: 'read-only', options: { read_only: true } }
    ])('copies the text from the rail when $state', async ({ options }) => {
      renderComponent(createTextareaWidget('test value', options), 'test value')

      const actions = screen.getByRole('group', { name: 'g.actions' })
      await userEvent.click(
        within(actions).getByRole('button', { name: 'g.copyToClipboard' })
      )

      expect(mockCopyToClipboard).toHaveBeenLastCalledWith('test value', {
        toastOnSuccess: false
      })
    })

    it('marks the button as copied for two seconds instead of showing a toast', async () => {
      mockCopyToClipboard.mockResolvedValue(true)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderComponent(createTextareaWidget('test value'), 'test value')

      await user.click(
        screen.getByRole('button', { name: 'g.copyToClipboard' })
      )
      await vi.advanceTimersByTimeAsync(0)

      expect(screen.getByRole('button', { name: 'g.copied' })).toBeVisible()

      await vi.advanceTimersByTimeAsync(2000)

      expect(
        screen.getByRole('button', { name: 'g.copyToClipboard' })
      ).toBeVisible()
    })

    it('keeps the copy label when copying fails', async () => {
      mockCopyToClipboard.mockResolvedValue(false)
      renderComponent(createTextareaWidget('test value'), 'test value')

      await userEvent.click(
        screen.getByRole('button', { name: 'g.copyToClipboard' })
      )

      expect(mockCopyToClipboard).toHaveBeenCalled()
      expect(
        screen.queryByRole('button', { name: 'g.copied' })
      ).not.toBeInTheDocument()
    })
  })

  describe('Character count', () => {
    it.for([
      { value: '', count: '0 chars' },
      { value: 'a', count: '1 char' },
      { value: 'a'.repeat(6644), count: '6,644 chars' }
    ])('shows "$count" in the rail', ({ value, count }) => {
      renderComponent(createTextareaWidget(value), value)

      const actions = screen.getByRole('group', { name: 'g.actions' })
      expect(within(actions).getByText(count)).toBeInTheDocument()
    })

    it('treats a null value as empty text', () => {
      renderComponent(createTextareaWidget(''), null)

      expect(screen.getByRole('textbox')).toHaveValue('')
      const actions = screen.getByRole('group', { name: 'g.actions' })
      expect(within(actions).getByText('0 chars')).toBeInTheDocument()
    })

    it('shows and counts a number value as text', () => {
      renderComponent(createTextareaWidget(''), 1024)

      expect(screen.getByRole('textbox')).toHaveValue('1024')
      const actions = screen.getByRole('group', { name: 'g.actions' })
      expect(within(actions).getByText('4 chars')).toBeInTheDocument()
    })

    it('counts the text as it is typed', async () => {
      const { rerender } = renderComponent(
        createTextareaWidget('abc'),
        'abc',
        undefined,
        (value) => rerender({ modelValue: value })
      )

      await userEvent.type(screen.getByRole('textbox'), 'de')

      expect(screen.getByText('5 chars')).toBeInTheDocument()
    })
  })

  describe('Locked Field Hover Styling', () => {
    // Tests assert on the Tailwind class name directly because that's the
    // mechanism being guarded — a rename would need a baseline update anyway.
    const HOVER_CLASS = 'hover:bg-muted'

    it('omits the generic hover background class from the wrapper when read-only', () => {
      const widget = createTextareaWidget('locked value', {
        read_only: true
      })
      const { container } = renderComponent(widget, 'locked value')

      // hover class lives on wrapper <div>, not the <textarea>
      // oxlint-disable-next-line testing-library/no-node-access
      const wrapper = container.firstElementChild
      expect(wrapper?.className).not.toContain(HOVER_CLASS)
    })

    it('omits the generic hover background class from the wrapper when disabled', () => {
      const widget = createTextareaWidget('linked value', { disabled: true })
      const { container } = renderComponent(widget, 'linked value')

      // hover class lives on wrapper <div>, not the <textarea>
      // oxlint-disable-next-line testing-library/no-node-access
      const wrapper = container.firstElementChild
      expect(wrapper?.className).not.toContain(HOVER_CLASS)
    })

    it('applies the generic hover background class to the wrapper when editable', () => {
      const widget = createTextareaWidget('editable value')
      const { container } = renderComponent(widget, 'editable value')

      // hover class lives on wrapper <div>, not the <textarea>
      // oxlint-disable-next-line testing-library/no-node-access
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

describe('WidgetTextarea expand to editor', () => {
  function renderWithDialogHost(
    widgetOverrides: Partial<SimplifiedWidget<string>> = {}
  ) {
    const onUpdateModelValue = vi.fn()
    render(GlobalDialog, { global: { plugins: [i18n] } })
    const view = render(WidgetTextarea, {
      props: {
        widget: createMockWidget({
          value: 'a portrait',
          name: 'text',
          ...widgetOverrides
        }),
        nodeTitle: 'CLIP Text Encode',
        modelValue: 'a portrait',
        'onUpdate:modelValue': onUpdateModelValue
      },
      global: { plugins: [i18n], mocks: { $t: (msg: string) => msg } }
    })
    return { onUpdateModelValue, view }
  }

  async function openEditor() {
    await userEvent.click(
      screen.getByRole('button', { name: 'textEditor.expand' })
    )
    const dialog = await screen.findByRole('dialog')
    return { dialog, editor: within(dialog).getByRole('textbox') }
  }

  it.for<{
    state: string
    overrides: Partial<SimplifiedWidget<string>>
    shown: boolean
  }>([
    { state: 'editable', overrides: {}, shown: true },
    {
      state: 'read-only',
      overrides: { options: { read_only: true } },
      shown: true
    },
    {
      state: 'linked',
      overrides: {
        options: { disabled: true },
        linkedUpstream: { nodeId: toNodeId('upstream') }
      },
      shown: false
    }
  ])('shows the expand button when $state: $shown', ({ overrides, shown }) => {
    renderWithDialogHost(overrides)

    const actions = screen.getByRole('group', { name: 'g.actions' })

    expect(
      Boolean(
        within(actions).queryByRole('button', { name: 'textEditor.expand' })
      )
    ).toBe(shown)
  })

  it.for([
    { label: undefined, title: 'text · CLIP Text Encode' },
    { label: 'Prompt', title: 'Prompt · CLIP Text Encode' }
  ])('opens a dialog titled "$title"', async ({ label, title }) => {
    renderWithDialogHost({ label })

    await openEditor()

    expect(screen.getByRole('dialog', { name: title })).toBeVisible()
  })

  it('writes each keystroke to the widget value while the dialog is open', async () => {
    const { onUpdateModelValue } = renderWithDialogHost()

    const { editor } = await openEditor()
    await userEvent.type(editor, ' at dusk')

    expect(onUpdateModelValue).toHaveBeenCalledTimes(' at dusk'.length)
    expect(onUpdateModelValue).toHaveBeenLastCalledWith('a portrait at dusk')
  })

  it('opens a read-only widget in a read-only editor', async () => {
    const { onUpdateModelValue } = renderWithDialogHost({
      options: { read_only: true }
    })

    const { editor } = await openEditor()
    await userEvent.type(editor, 'more')

    expect(editor).toHaveAttribute('readonly')
    expect(onUpdateModelValue).not.toHaveBeenCalled()
  })

  it("keeps the widget's native textarea limits in the editor", async () => {
    const options = { multiline: true, maxlength: 12 }
    const { view } = renderWithDialogHost({ options })
    const { editor } = await openEditor()
    expect(editor).toHaveAttribute('maxlength', '12')

    const changed = { multiline: true, maxlength: 4 }
    await view.rerender({
      widget: createMockWidget({
        value: 'a portrait',
        name: 'text',
        options: changed
      })
    })

    expect(editor).toHaveAttribute('maxlength', '4')
  })

  it('opens a disabled widget read-only with its text still selectable', async () => {
    renderWithDialogHost({ options: { disabled: true } })

    const { editor } = await openEditor()

    expect(editor).toHaveAttribute('readonly')
    expect(editor).toBeEnabled()
  })

  it('closes the dialog when the widget unmounts', async () => {
    const { view } = renderWithDialogHost()

    await openEditor()
    view.unmount()

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
