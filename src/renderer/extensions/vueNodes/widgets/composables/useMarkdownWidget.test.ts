import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as Litegraph from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useMarkdownWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget'
import { createMockDOMWidgetNode } from '@/renderer/extensions/vueNodes/widgets/composables/__tests__/domWidgetTestUtils'

const { canvasMock } = vi.hoisted(() => ({
  canvasMock: {
    processMouseDown: vi.fn(),
    processMouseMove: vi.fn(),
    processMouseUp: vi.fn()
  }
}))

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

function createMarkdownWidget(node: LGraphNode) {
  const inputSpec: InputSpec = {
    type: 'MARKDOWN',
    name: 'note',
    default: ''
  }
  return useMarkdownWidget()(node, inputSpec) as ReturnType<
    ReturnType<typeof useMarkdownWidget>
  > & { element: HTMLElement }
}

describe('useMarkdownWidget', () => {
  let widget: ReturnType<typeof createMarkdownWidget>
  let inputEl: HTMLElement
  let textarea: HTMLTextAreaElement
  let callback: ReturnType<typeof vi.fn<(value: string) => void>>
  let parentKeydown: ReturnType<typeof vi.fn<(ev: KeyboardEvent) => void>>

  beforeEach(() => {
    vi.clearAllMocks()
    const node = createMockDOMWidgetNode()
    widget = createMarkdownWidget(node)
    callback = vi.fn<(value: string) => void>()
    widget.callback = callback
    inputEl = widget.element
    textarea = inputEl.querySelector('textarea')!
    parentKeydown = vi.fn<(ev: KeyboardEvent) => void>()
    document.body.append(inputEl)
    document.body.addEventListener('keydown', parentKeydown)
  })

  afterEach(() => {
    document.body.removeEventListener('keydown', parentKeydown)
    inputEl.remove()
  })

  it('fires the widget callback on textarea input and change', () => {
    textarea.value = 'hello'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('toggles editing on dblclick/blur and stops keydown propagation', () => {
    inputEl.dispatchEvent(new Event('dblclick', { bubbles: true }))
    expect(inputEl.classList.contains('editing')).toBe(true)

    textarea.dispatchEvent(new Event('blur'))
    expect(inputEl.classList.contains('editing')).toBe(false)

    inputEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
    expect(parentKeydown).not.toHaveBeenCalled()
  })

  it('forwards middle-click pointer events to the canvas while alive', () => {
    inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 1 }))
    inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 4 }))
    inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 1 }))

    expect(canvasMock.processMouseDown).toHaveBeenCalledTimes(1)
    expect(canvasMock.processMouseMove).toHaveBeenCalledTimes(1)
    expect(canvasMock.processMouseUp).toHaveBeenCalledTimes(1)
  })

  it('detaches every listener and lets keydown bubble after removal', () => {
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
})
