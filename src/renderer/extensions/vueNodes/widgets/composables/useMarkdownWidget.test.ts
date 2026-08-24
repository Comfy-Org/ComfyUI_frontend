import { describe, expect, it, onTestFinished, vi } from 'vitest'

import type * as Litegraph from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { DOMWidget } from '@/scripts/domWidget'
import { useMarkdownWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget'
import { createMockDOMWidgetNode } from '@/renderer/extensions/vueNodes/widgets/composables/domWidgetTestUtils'

const { canvasMock, createMarkdownEditorMock, setContentSpy, destroySpy } =
  vi.hoisted(() => {
    const setContentSpy = vi.fn()
    const destroySpy = vi.fn()
    return {
      canvasMock: {
        processMouseDown: vi.fn(),
        processMouseMove: vi.fn(),
        processMouseUp: vi.fn()
      },
      setContentSpy,
      destroySpy,
      createMarkdownEditorMock: vi.fn((_el: HTMLElement, content: string) => ({
        __content: content,
        isDestroyed: false,
        destroy: destroySpy,
        commands: { setContent: setContentSpy }
      }))
    }
  })

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: { id: 'root' }, canvas: canvasMock }
}))
vi.mock('@/lib/litegraph/src/litegraph', async (importOriginal) => {
  const actual = await importOriginal<typeof Litegraph>()
  return { ...actual, resolveNodeRootGraphId: vi.fn(() => 'root') }
})
vi.mock('@/stores/widgetValueStore', () => ({
  useWidgetValueStore: () => ({ getWidget: () => undefined })
}))
vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/markdownEditor',
  () => ({ createMarkdownEditor: createMarkdownEditorMock })
)

const flushEditorAttach = () => new Promise<void>((r) => setTimeout(r, 0))

function createMarkdownWidget(node: LGraphNode) {
  const inputSpec: InputSpec = {
    type: 'MARKDOWN',
    name: 'note',
    default: ''
  }
  return useMarkdownWidget()(node, inputSpec) as DOMWidget<HTMLElement, string>
}

describe('useMarkdownWidget', () => {
  function setup() {
    vi.clearAllMocks()
    const node = createMockDOMWidgetNode()
    const widget = createMarkdownWidget(node)
    const callback = vi.fn<(value: string) => void>()
    widget.callback = callback
    const inputEl = widget.element
    const textarea = inputEl.querySelector('textarea')!
    const parentKeydown = vi.fn<(ev: KeyboardEvent) => void>()
    document.body.append(inputEl)
    document.body.addEventListener('keydown', parentKeydown)
    onTestFinished(() => {
      document.body.removeEventListener('keydown', parentKeydown)
      inputEl.remove()
    })
    return { widget, inputEl, textarea, callback, parentKeydown }
  }

  it('fires the widget callback on textarea input and change', () => {
    const { textarea, callback } = setup()
    textarea.value = 'hello'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('toggles editing on dblclick/blur and stops keydown propagation', () => {
    const { inputEl, textarea, parentKeydown } = setup()
    inputEl.dispatchEvent(new Event('dblclick', { bubbles: true }))
    expect(inputEl.classList.contains('editing')).toBe(true)

    textarea.dispatchEvent(new Event('blur'))
    expect(inputEl.classList.contains('editing')).toBe(false)

    inputEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
    expect(parentKeydown).not.toHaveBeenCalled()
  })

  it('forwards middle-click pointer events to the canvas while alive', () => {
    const { inputEl } = setup()
    inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 1 }))
    inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 4 }))
    inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 1 }))

    expect(canvasMock.processMouseDown).toHaveBeenCalledTimes(1)
    expect(canvasMock.processMouseMove).toHaveBeenCalledTimes(1)
    expect(canvasMock.processMouseUp).toHaveBeenCalledTimes(1)
  })

  it('detaches every listener and lets keydown bubble after removal', () => {
    const { widget, inputEl, textarea, callback, parentKeydown } = setup()
    widget.onRemove?.()

    textarea.value = 'after'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
    inputEl.dispatchEvent(new Event('dblclick', { bubbles: true }))
    inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 1 }))
    inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 4 }))
    inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 1 }))
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))

    expect(callback).not.toHaveBeenCalled()
    expect(canvasMock.processMouseDown).not.toHaveBeenCalled()
    expect(canvasMock.processMouseMove).not.toHaveBeenCalled()
    expect(canvasMock.processMouseUp).not.toHaveBeenCalled()
    expect(inputEl.classList.contains('editing')).toBe(false)
    // keydown listener (which called stopPropagation) is gone, so the event
    // now bubbles to the parent.
    expect(parentKeydown).toHaveBeenCalledTimes(1)
  })

  it('survives onRemove being invoked twice', () => {
    const { widget } = setup()
    widget.onRemove?.()
    expect(() => widget.onRemove?.()).not.toThrow()
  })

  it('has a fully interactive shell before the editor chunk resolves', () => {
    const { textarea, callback } = setup()
    expect(createMarkdownEditorMock).not.toHaveBeenCalled()
    textarea.value = 'typed'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('mounts the editor with the current value, not the construction default', async () => {
    const { textarea } = setup()
    textarea.value = 'edited during load'

    await flushEditorAttach()

    expect(createMarkdownEditorMock).toHaveBeenCalledTimes(1)
    const [, content] = createMarkdownEditorMock.mock.calls[0]
    expect(content).toBe('edited during load')
  })

  it('routes content to the editor only once it has attached', async () => {
    const { textarea } = setup()

    textarea.dispatchEvent(new Event('change', { bubbles: true }))
    expect(setContentSpy).not.toHaveBeenCalled()

    await flushEditorAttach()

    textarea.value = 'after attach'
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
    expect(setContentSpy).toHaveBeenCalledWith('after attach')
  })

  it('setValue writes the editor once attached and is a no-op on it before', async () => {
    let captured: { setValue?: (v: string) => void } = {}
    const node = createMockDOMWidgetNode({
      addDOMWidget: vi.fn(
        (name: string, type: string, element: HTMLElement, options) => {
          captured = options
          return { name, type, element, options: {}, value: '' }
        }
      )
    })
    const widget = createMarkdownWidget(node)
    const inputEl = widget.element
    document.body.append(inputEl)
    onTestFinished(() => inputEl.remove())

    expect(() => captured.setValue?.('before')).not.toThrow()
    expect(inputEl.querySelector('textarea')!.value).toBe('before')
    expect(setContentSpy).not.toHaveBeenCalled()

    await flushEditorAttach()

    captured.setValue?.('after')
    expect(setContentSpy).toHaveBeenCalledWith('after')
  })

  it('does not mount the editor if the node is removed before the chunk resolves', async () => {
    const { widget } = setup()
    widget.onRemove?.()

    await flushEditorAttach()

    expect(createMarkdownEditorMock).not.toHaveBeenCalled()
    expect(destroySpy).not.toHaveBeenCalled()
  })

  it('destroys the attached editor on removal', async () => {
    const { widget } = setup()
    await flushEditorAttach()
    expect(createMarkdownEditorMock).toHaveBeenCalledTimes(1)

    widget.onRemove?.()

    expect(destroySpy).toHaveBeenCalledTimes(1)
  })

  it('degrades to the shell when the editor chunk fails to load', async () => {
    createMarkdownEditorMock.mockImplementationOnce(() => {
      throw new Error('chunk load failed')
    })
    const { textarea, callback } = setup()

    await flushEditorAttach()

    textarea.value = 'still works'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
