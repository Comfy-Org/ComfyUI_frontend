import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { reportError as reportErrorMock } from '@comfyorg/telemetry/reportError'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import { app } from '@/scripts/app'
import { isDOMWidget } from '@/scripts/domWidget'
import { useMarkdownWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget'
import { useDOMWidgetTestNodes } from '@/renderer/extensions/vueNodes/widgets/composables/domWidgetTestUtils'
import { createMarkdownEditor } from '@/renderer/extensions/vueNodes/widgets/composables/markdownEditor'

const createDOMWidgetNode = useDOMWidgetTestNodes()

vi.mock(import('@/scripts/app'))
vi.mock(import('@comfyorg/telemetry/reportError'))

vi.mock(
  import('@/renderer/extensions/vueNodes/widgets/composables/markdownEditor'),
  { spy: true }
)

function createMarkdownWidget(node: LGraphNode, defaultValue = '') {
  const inputSpec: InputSpec = {
    type: 'MARKDOWN',
    name: 'note',
    default: defaultValue
  }
  const widget = useMarkdownWidget()(node, inputSpec)
  assert(isDOMWidget(widget))
  return widget
}

describe('useMarkdownWidget', () => {
  function setup() {
    vi.clearAllMocks()
    const node = createDOMWidgetNode()
    const widget = createMarkdownWidget(node)
    const callback = vi.fn<NonNullable<typeof widget.callback>>()
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
    return {
      widget,
      inputEl,
      textarea,
      callback,
      parentKeydown,
      canvasMock: app.canvas
    }
  }

  it('notifies once per textarea input and separately on change', () => {
    const node = createDOMWidgetNode()
    const widget = createMarkdownWidget(node)
    const textarea = widget.element.querySelector('textarea')!
    const callback = vi.fn()
    widget.callback = callback
    textarea.value = 'hello'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    expect(callback).toHaveBeenCalledExactlyOnceWith('hello')
    expect(widget.value).toBe('hello')
    textarea.value = 'changed'
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenLastCalledWith('changed')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    expect(callback).toHaveBeenCalledTimes(3)
    expect(callback).toHaveBeenLastCalledWith('changed')
  })

  it('preserves input notifications from non-textarea elements', () => {
    const { inputEl, callback } = setup()
    inputEl.dispatchEvent(new Event('input', { bubbles: true }))
    expect(callback).toHaveBeenCalledExactlyOnceWith('')
  })

  it('fires the real widget callback once when its value is assigned', () => {
    const { widget, textarea, callback } = setup()
    widget.value = 'assigned'

    expect(callback).toHaveBeenCalledExactlyOnceWith('assigned')
    expect(textarea.value).toBe('assigned')
  })

  it('renders Markdown links and tables', async () => {
    const node = createDOMWidgetNode()
    const widget = createMarkdownWidget(
      node,
      '[Comfy](https://www.comfy.org)\n\n| Name |\n| --- |\n| Comfy |'
    )

    await expect
      .poll(() => widget.element.querySelector('a')?.textContent)
      .toBe('Comfy')
    expect(widget.element.querySelector('table')?.textContent).toContain('Name')
  })

  it('renders text edited before the editor finishes loading', async () => {
    const node = createDOMWidgetNode()
    const widget = createMarkdownWidget(node, 'default')

    const textarea = widget.element.querySelector('textarea')!
    textarea.value = '# Loaded later'
    textarea.dispatchEvent(new Event('change'))

    await expect
      .poll(() => widget.element.querySelector('h1')?.textContent)
      .toBe('Loaded later')
    expect(widget.element.textContent).not.toContain('default')
  })

  it('reports an editor that fails to construct', async () => {
    const error = new Error('schema conflict')
    vi.mocked(createMarkdownEditor).mockImplementationOnce(() => {
      throw error
    })
    createMarkdownWidget(createDOMWidgetNode())

    await vi.waitFor(() =>
      expect(reportErrorMock).toHaveBeenCalledWith(error, {
        errorType: 'error_loading_markdown_editor',
        surface: 'platform'
      })
    )
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
    const { inputEl, canvasMock } = setup()
    inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 1 }))
    inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 4 }))
    inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 1 }))

    expect(canvasMock.processMouseDown).toHaveBeenCalledTimes(1)
    expect(canvasMock.processMouseMove).toHaveBeenCalledTimes(1)
    expect(canvasMock.processMouseUp).toHaveBeenCalledTimes(1)
  })

  it('detaches every listener and lets keydown bubble after removal', () => {
    const { widget, inputEl, textarea, callback, parentKeydown, canvasMock } =
      setup()
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
    expect(parentKeydown).toHaveBeenCalledTimes(1)
  })

  it('survives onRemove being invoked twice', () => {
    const { widget } = setup()
    widget.onRemove?.()
    expect(() => widget.onRemove?.()).not.toThrow()
  })
})
