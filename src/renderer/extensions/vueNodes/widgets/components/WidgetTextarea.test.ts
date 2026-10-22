import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { HideLayoutFieldKey } from '@/types/widgetTypes'
import { EnhancePromptStateKey } from '@/workbench/extensions/agent/composables/useEnhancePrompt'
import { enhancePromptRequest } from '@/workbench/extensions/agent/services/enhancePromptRequest'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

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

vi.mock(
  import('@/workbench/extensions/agent/services/enhancePromptRequest'),
  () => ({
    enhancePromptRequest: vi.fn(async () => ({
      ok: true as const,
      prompt: 'enhanced prompt'
    }))
  })
)

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
  onUpdateModelValue?: (...args: unknown[]) => void,
  nodeType?: string
) {
  return render(WidgetTextarea, {
    props: {
      widget,
      modelValue,
      placeholder,
      nodeType,
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

describe('WidgetTextarea enhance prompt', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = false
  })

  it('hides the enhance button when the agent is unavailable', () => {
    const widget = createTextareaWidget('a prompt')
    renderComponent(widget, 'a prompt', undefined, undefined, 'CLIPTextEncode')

    expect(
      screen.queryByRole('button', { name: 'agent.enhancePrompt' })
    ).not.toBeInTheDocument()
  })

  it('shows the enhance button on CLIP text encode nodes when the agent is enabled', () => {
    useAgentPanelStore().enabled = true
    const widget = createTextareaWidget('a prompt')
    renderComponent(widget, 'a prompt', undefined, undefined, 'CLIPTextEncode')

    expect(
      screen.getByRole('button', { name: 'agent.enhancePrompt' })
    ).toBeInTheDocument()
  })

  it('uses the small in-field icon button size', () => {
    useAgentPanelStore().enabled = true
    const widget = createTextareaWidget('a prompt')
    renderComponent(widget, 'a prompt', undefined, undefined, 'CLIPTextEncode')

    const button = screen.getByRole('button', { name: 'agent.enhancePrompt' })
    expect(button).toHaveClass('size-5')
    expect(button.innerHTML).toContain('size-3')
  })

  it('hides the in-field button when hideEnhance is set', () => {
    useAgentPanelStore().enabled = true
    const widget = createTextareaWidget('a prompt')
    render(WidgetTextarea, {
      props: {
        widget,
        modelValue: 'a prompt',
        nodeType: 'CLIPTextEncode',
        hideEnhance: true
      },
      global: {
        mocks: {
          $t: (msg: string) => msg
        }
      }
    })

    expect(
      screen.queryByRole('button', { name: 'agent.enhancePrompt' })
    ).not.toBeInTheDocument()
  })

  it('hides the in-field button when the properties panel owns the control', () => {
    useAgentPanelStore().enabled = true
    const widget = createTextareaWidget('a prompt')
    render(WidgetTextarea, {
      props: {
        widget,
        modelValue: 'a prompt',
        nodeType: 'CLIPTextEncode'
      },
      global: {
        provide: { [HideLayoutFieldKey as symbol]: true },
        mocks: {
          $t: (msg: string) => msg
        }
      }
    })

    expect(
      screen.queryByRole('button', { name: 'agent.enhancePrompt' })
    ).not.toBeInTheDocument()
  })

  it('locks the field and shimmers the prompt when the properties panel is enhancing', () => {
    const widget = createTextareaWidget('a prompt')
    render(WidgetTextarea, {
      props: {
        widget,
        modelValue: 'a prompt',
        nodeType: 'CLIPTextEncode'
      },
      global: {
        provide: {
          [EnhancePromptStateKey as symbol]: {
            isLocked: ref(true),
            isProcessing: ref(true),
            isRevealing: ref(false),
            revealText: ref(''),
            revealStaggerMs: ref(0)
          }
        },
        mocks: {
          $t: (msg: string) => msg
        }
      }
    })

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('readonly')
    expect(textarea).toHaveClass('agent-shimmer-text')
    expect(textarea).toHaveValue('a prompt')
    expect(
      screen.queryByRole('button', { name: 'agent.enhancePrompt' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('a prompt')).not.toBeInTheDocument()
  })

  it('shimmers the textarea text in place and locks the input while enhance is in flight', async () => {
    useAgentPanelStore().enabled = true
    let resolveRequest: (result: { ok: true; prompt: string }) => void = () =>
      undefined
    vi.mocked(enhancePromptRequest).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    )
    const widget = createTextareaWidget('a prompt')
    renderComponent(widget, 'a prompt', undefined, undefined, 'CLIPTextEncode')

    await userEvent.click(
      screen.getByRole('button', { name: 'agent.enhancePrompt' })
    )

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('readonly')
    expect(textarea).toHaveClass('agent-shimmer-text')
    expect(textarea).toHaveValue('a prompt')
    expect(screen.queryByText('a prompt')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'agent.enhancingPrompt' })
    ).toBeDisabled()

    resolveRequest({ ok: true, prompt: 'enhanced prompt' })
    await vi.waitFor(() => {
      expect(screen.getByText('enhanced')).toHaveClass('agent-talk-word')
    })
    expect(screen.getByRole('textbox')).toHaveClass('invisible')
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
    expect(screen.getByRole('textbox')).toHaveValue('a prompt')

    await vi.waitFor(() => {
      expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly')
    })
    expect(screen.getByRole('textbox')).toHaveValue('enhanced prompt')
    expect(screen.queryByText('enhanced')).not.toBeInTheDocument()
  })

  it('shares processing and reveal with another textarea for the same widget', async () => {
    useAgentPanelStore().enabled = true
    const id = widgetId('test-graph-id', toNodeId(1), 'prompt')
    let resolveRequest: (result: { ok: true; prompt: string }) => void = () =>
      undefined
    vi.mocked(enhancePromptRequest).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    )
    const widget = createTextareaWidget('a prompt')
    render(WidgetTextarea, {
      props: {
        widget,
        modelValue: 'a prompt',
        nodeType: 'CLIPTextEncode',
        widgetId: id
      },
      global: {
        mocks: { $t: (msg: string) => msg }
      }
    })
    render(WidgetTextarea, {
      props: {
        widget,
        modelValue: 'a prompt',
        nodeType: 'CLIPTextEncode',
        widgetId: id
      },
      global: {
        provide: { [HideLayoutFieldKey as symbol]: true },
        mocks: { $t: (msg: string) => msg }
      }
    })

    const [canvasField, panelField] = screen.getAllByRole('textbox')
    await userEvent.click(
      screen.getByRole('button', { name: 'agent.enhancePrompt' })
    )

    expect(canvasField).toHaveAttribute('readonly')
    expect(panelField).toHaveAttribute('readonly')
    expect(canvasField).toHaveClass('agent-shimmer-text')
    expect(panelField).toHaveClass('agent-shimmer-text')
    expect(enhancePromptRequest).toHaveBeenCalledOnce()

    resolveRequest({ ok: true, prompt: 'enhanced prompt' })
    await vi.waitFor(() => {
      expect(screen.getAllByText('enhanced').length).toBeGreaterThan(0)
    })
    expect(canvasField).toHaveClass('invisible')
    expect(panelField).toHaveClass('invisible')
    expect(canvasField).toHaveValue('a prompt')
    expect(panelField).toHaveValue('a prompt')
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
