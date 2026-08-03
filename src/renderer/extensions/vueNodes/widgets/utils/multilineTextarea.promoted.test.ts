import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/app', () => ({
  app: { canvas: { processMouseWheel: vi.fn() } }
}))

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { DOMWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId as makeWidgetId } from '@/types/widgetId'

import { createPromotedMultilineWidget } from './multilineTextarea'

const WIDGET_ID = makeWidgetId('graph-1', toNodeId('node-1'), 'prompt')

function subgraphNode(): LGraphNode {
  const node = fromAny<LGraphNode, unknown>({
    id: 'node-1',
    graph: {
      rootGraph: { id: 'graph-1' },
      getNodeById: (id: unknown) =>
        id === toNodeId('node-1') ? node : undefined
    }
  })
  return node
}

function textareaSource(): IBaseWidget {
  return fromAny<IBaseWidget, unknown>({
    name: 'prompt',
    type: 'customtext',
    element: document.createElement('textarea')
  })
}

function promote(
  source: IBaseWidget = textareaSource()
): IBaseWidget | undefined {
  return createPromotedMultilineWidget({
    subgraphNode: subgraphNode(),
    input: fromAny({ name: 'prompt', widgetId: WIDGET_ID }),
    widgetId: WIDGET_ID,
    sourceWidget: source
  })
}

describe('createPromotedMultilineWidget', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    useWidgetValueStore().registerWidget(WIDGET_ID, {
      type: 'customtext',
      value: 'hello',
      options: {}
    })
  })

  it('materializes a promoted textarea as a registered DOM widget', () => {
    const widget = promote()

    expect(widget).toBeDefined()
    const domWidget = widget as unknown as DOMWidget<
      HTMLTextAreaElement,
      string
    >
    expect(domWidget.element).toBeInstanceOf(HTMLTextAreaElement)
    expect(useDomWidgetStore().widgetStates.has(domWidget.id)).toBe(true)
  })

  it('reads its value from the host widget store entry', () => {
    const widget = promote()
    expect(widget?.value).toBe('hello')
  })

  it('writes textarea edits back to the host widget store entry', () => {
    const widget = promote()
    const element = (
      widget as unknown as DOMWidget<HTMLTextAreaElement, string>
    ).element

    element.value = 'edited'
    element.dispatchEvent(new Event('input'))

    expect(useWidgetValueStore().getWidget(WIDGET_ID)?.value).toBe('edited')
  })

  it('falls back to the canvas projection for non-DOM widgets', () => {
    const widget = promote(fromAny({ name: 'prompt', type: 'number' }))
    expect(widget).toBeUndefined()
  })

  it('defers materialization while the host node is not settled in its graph', () => {
    const unsettled = fromAny<LGraphNode, unknown>({
      id: 'node-1',
      graph: { rootGraph: { id: 'graph-1' }, getNodeById: () => undefined }
    })

    const widget = createPromotedMultilineWidget({
      subgraphNode: unsettled,
      input: fromAny({ name: 'prompt', widgetId: WIDGET_ID }),
      widgetId: WIDGET_ID,
      sourceWidget: textareaSource()
    })

    expect(widget).toBeUndefined()
    expect(useDomWidgetStore().widgetStates.size).toBe(0)
  })
})
