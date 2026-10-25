import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
// Installs `addDOMWidget` on the LGraphNode prototype for the real-graph cases.
import '@/scripts/domWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { DOMWidget } from '@/types/domWidget'
import { useStringWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget'
import { createMockDOMWidgetNode } from '@/renderer/extensions/vueNodes/widgets/composables/domWidgetTestUtils'

const { canvasMock } = vi.hoisted(() => ({
  canvasMock: {
    processMouseDown: vi.fn(),
    processMouseMove: vi.fn(),
    processMouseUp: vi.fn(),
    processMouseWheel: vi.fn()
  }
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { rootGraph: { id: 'root' }, canvas: canvasMock }
}))

function createStringWidget(node: LGraphNode) {
  const inputSpec: InputSpec = {
    type: 'STRING',
    name: 'prompt',
    default: '',
    multiline: true
  }
  return useStringWidget()(node, inputSpec) as DOMWidget<
    HTMLTextAreaElement,
    string
  >
}

describe('useStringWidget (multiline)', () => {
  function setup() {
    vi.clearAllMocks()
    const node = createMockDOMWidgetNode()
    const widget = createStringWidget(node)
    const callback = vi.fn<(value: string) => void>()
    widget.callback = callback
    const inputEl = widget.element
    document.body.append(inputEl)
    onTestFinished(() => inputEl.remove())
    return { node, widget, inputEl, callback }
  }

  function setupInGraph() {
    const graph = new LGraph()
    const node = new LGraphNode('Test')
    graph.add(node)
    return { graph, node }
  }

  it('writes the value into the store when no entry exists yet', () => {
    const { node } = setup()

    // The real DOMWidget value setter delegates to options.setValue
    // (domWidget.ts). Invoke the actual closure the composable registered.
    const addDOMWidget = node.addDOMWidget as unknown as {
      mock: { calls: unknown[][] }
    }
    const options = addDOMWidget.mock.calls[0][3] as {
      setValue: (v: string) => void
    }
    options.setValue('from-execution')

    const entries = useWidgetValueStore().getNodeWidgets('root', toNodeId(1))
    expect(entries.some((s) => s.value === 'from-execution')).toBe(true)
    expect(entries.every((s) => s.type === 'customtext')).toBe(true)
  })

  it('writes and reads under its new name after a rename', () => {
    const { graph, node } = setupInGraph()
    const widget = createStringWidget(node)
    widget.value = 'before'

    widget.name = 'loras.1.text'
    widget.value = 'edited'

    const store = useWidgetValueStore()
    expect(
      store.getWidget(widgetId(graph.id, node.id, 'loras.1.text'))?.value
    ).toBe('edited')
    expect(store.getWidget(widgetId(graph.id, node.id, 'prompt'))).toBe(
      undefined
    )
    widget.element.value = 'textarea only'
    expect(widget.value).toBe('edited')
  })

  it('keeps a sibling widget value when its own name is made unique while it is added', () => {
    const { graph, node } = setupInGraph()
    node.addWidget('text', 'prompt', 'sibling', () => {})

    const widget = createStringWidget(node)

    expect(widget.name).toBe('prompt#1')
    widget.value = 'mine'
    expect(
      useWidgetValueStore().getWidget(widgetId(graph.id, node.id, 'prompt#1'))
        ?.value
    ).toBe('mine')
    expect(
      useWidgetValueStore().getWidget(widgetId(graph.id, node.id, 'prompt'))
        ?.value
    ).toBe('sibling')
  })

  it('keeps writing its own entry while an extension splices it out of the widget list', () => {
    const { graph, node } = setupInGraph()
    node.addWidget('text', 'prompt', 'sibling', () => {})
    const widget = createStringWidget(node)
    widget.value = 'mine'
    const store = useWidgetValueStore()

    node.widgets!.splice(node.widgets!.indexOf(widget), 1)
    widget.value = 'hidden edit'

    expect(
      store.getWidget(widgetId(graph.id, node.id, 'prompt#1'))?.value
    ).toBe('hidden edit')
    expect(store.getWidget(widgetId(graph.id, node.id, 'prompt'))?.value).toBe(
      'sibling'
    )
    node.widgets!.push(widget)
    expect(widget.value).toBe('hidden edit')
  })

  it('follows a rename after its element is replaced', () => {
    const { graph, node } = setupInGraph()
    const widget = createStringWidget(node)
    widget.value = 'before'

    widget.element = document.createElement('textarea')
    widget.name = 'renamed'
    widget.value = 'after'

    const store = useWidgetValueStore()
    expect(store.getWidget(widgetId(graph.id, node.id, 'renamed'))?.value).toBe(
      'after'
    )
    expect(store.getWidget(widgetId(graph.id, node.id, 'prompt'))).toBe(
      undefined
    )
  })

  it('leaves the store alone once it is removed and another widget takes its name', () => {
    const { graph, node } = setupInGraph()
    const widget = createStringWidget(node)
    widget.value = 'mine'

    node.removeWidget(widget)
    node.addWidget('text', 'prompt', 'other', () => {})

    expect(widget.value).toBe('mine')
    widget.value = 'late'
    expect(
      useWidgetValueStore().getWidget(widgetId(graph.id, node.id, 'prompt'))
        ?.value
    ).toBe('other')
  })

  it('does not throw when a saved value is restored synchronously during construction', () => {
    // Mirrors LGraphNode.addCustomWidget, which restores a saved widget
    // value (from a loaded workflow) by invoking `options.setValue`
    // synchronously, from inside `node.addDOMWidget(...)`, before that
    // call returns.
    const node = createMockDOMWidgetNode({
      addDOMWidget: vi.fn(
        (
          name: string,
          type: string,
          element: HTMLElement,
          options?: { setValue?: (v: string) => void }
        ) => {
          options?.setValue?.('restored-value')
          return { name, type, element, options: options ?? {}, value: '' }
        }
      )
    })

    expect(() => createStringWidget(node)).not.toThrow()
  })

  it('fires the widget callback on input', () => {
    const { inputEl, callback } = setup()
    inputEl.value = 'hello'
    inputEl.dispatchEvent(new Event('input', { bubbles: true }))
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('forwards middle-click pointer events and ctrl+wheel to the canvas while alive', () => {
    const { inputEl } = setup()
    inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 1 }))
    inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 4 }))
    inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 1 }))
    inputEl.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true }))

    expect(canvasMock.processMouseDown).toHaveBeenCalledTimes(1)
    expect(canvasMock.processMouseMove).toHaveBeenCalledTimes(1)
    expect(canvasMock.processMouseUp).toHaveBeenCalledTimes(1)
    expect(canvasMock.processMouseWheel).toHaveBeenCalledTimes(1)
  })

  it('detaches every listener when the widget is removed', () => {
    const { widget, inputEl, callback } = setup()
    widget.onRemove?.()

    inputEl.value = 'after'
    inputEl.dispatchEvent(new Event('input', { bubbles: true }))
    inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 1 }))
    inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 4 }))
    inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 1 }))
    inputEl.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true }))

    expect(callback).not.toHaveBeenCalled()
    expect(canvasMock.processMouseDown).not.toHaveBeenCalled()
    expect(canvasMock.processMouseMove).not.toHaveBeenCalled()
    expect(canvasMock.processMouseUp).not.toHaveBeenCalled()
    expect(canvasMock.processMouseWheel).not.toHaveBeenCalled()
  })
})
