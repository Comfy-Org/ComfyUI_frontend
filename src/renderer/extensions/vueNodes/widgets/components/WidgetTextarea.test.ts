import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { toNodeId } from '@/types/nodeId'
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
  modelValue: string,
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
    it('hides copy button when not read-only', async () => {
      const widget = createTextareaWidget('test')
      renderComponent(widget, 'test')

      expect(
        screen.queryByRole('button', { name: 'g.copyToClipboard' })
      ).not.toBeInTheDocument()
    })

    it('copy button sits in an action group that is transparent by default when read-only', () => {
      const widget = createTextareaWidget('test', { read_only: true })
      renderComponent(widget, 'test')

      const actions = screen.getByRole('group', { name: 'g.actions' })
      expect(
        within(actions).getByRole('button', { name: 'g.copyToClipboard' })
      ).toBeInTheDocument()
      expect(actions.classList.contains('opacity-0')).toBe(true)
    })

    it('copy button is revealed on group hover when read-only, and copies on click', async () => {
      const widget = createTextareaWidget('test value', { read_only: true })
      renderComponent(widget, 'test value')

      const actions = screen.getByRole('group', { name: 'g.actions' })
      expect(actions.classList.contains('group-hover:opacity-100')).toBe(true)
      const button = within(actions).getByRole('button', {
        name: 'g.copyToClipboard'
      })

      await userEvent.click(button)

      expect(mockCopyToClipboard).toHaveBeenCalledWith('test value')
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

describe('WidgetTextarea expand to the side panel', () => {
  function renderOnNode(
    widgetOverrides: Partial<SimplifiedWidget<string>> = {}
  ) {
    const graph = createTestRootGraph()
    const node = new LGraphNode('CLIP Text Encode')
    const nodeWidget = node.addWidget('text', 'text', 'a portrait', () => {})
    graph.add(node)
    useCanvasStore().currentGraph = graph
    render(WidgetTextarea, {
      props: {
        widget: createMockWidget({
          value: 'a portrait',
          name: 'text',
          ...widgetOverrides
        }),
        nodeId: node.id,
        modelValue: 'a portrait'
      },
      global: { mocks: { $t: (msg: string) => msg } }
    })
    return { node, nodeWidget }
  }

  it.for<{
    state: string
    overrides: Partial<SimplifiedWidget<string>>
    appMode?: boolean
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
    },
    { state: 'in app mode', overrides: {}, appMode: true, shown: false }
  ])(
    'shows the expand button on hover when $state: $shown',
    ({ overrides, appMode = false, shown }) => {
      useCanvasStore().linearMode = appMode
      renderOnNode(overrides)

      const actions = screen.getByRole('group', { name: 'g.actions' })

      expect(
        Boolean(
          within(actions).queryByRole('button', { name: 'textEditor.expand' })
        )
      ).toBe(shown)
      expect(actions.classList.contains('opacity-0')).toBe(true)
      expect(actions.classList.contains('group-hover:opacity-100')).toBe(true)
    }
  )

  it('opens the Text tab of the side panel on its widget', async () => {
    const { node, nodeWidget } = renderOnNode()

    await userEvent.click(
      screen.getByRole('button', { name: 'textEditor.expand' })
    )

    const rightSidePanelStore = useRightSidePanelStore()
    expect(rightSidePanelStore.isTextEditorActive).toBe(true)
    expect(rightSidePanelStore.textEditorTarget).toEqual({
      node,
      widget: nodeWidget
    })
  })
})
