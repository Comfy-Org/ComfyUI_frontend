import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ICompositorWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import {
  getCompositorWidgetValue,
  resetCompositorStateWidgets,
  setCompositorWidgetValue
} from './compositorWidgets'

const GRAPH_ID = 'compositor-test-graph'

let nodeCounter = 0

function makeNode({ registered = true } = {}): LGraphNode {
  nodeCounter += 1
  const nodeId = toNodeId(nodeCounter)
  if (registered) {
    useWidgetValueStore().registerWidget(
      widgetId(GRAPH_ID, nodeId, 'compositor'),
      { type: 'compositor', value: { layers: [] }, options: {} }
    )
  }
  return createMockLGraphNode({
    id: nodeId,
    graph: { rootGraph: { id: GRAPH_ID } }
  })
}

function storedValue(node: LGraphNode): unknown {
  return useWidgetValueStore().getWidget(
    widgetId(GRAPH_ID, node.id, 'compositor')
  )?.value
}

describe('setCompositorWidgetValue', () => {
  it('writes the widget value to the store', () => {
    const node = makeNode()
    const next = { canvas: { w: 8, h: 8 }, layers: [] }

    setCompositorWidgetValue(node, next)

    expect(storedValue(node)).toEqual(next)
  })

  it('falls back to the widget object when the store has no entry', () => {
    const node = makeNode({ registered: false })
    const widget = fromPartial<ICompositorWidget>({
      name: 'compositor',
      type: 'compositor',
      value: { layers: [] }
    })
    node.widgets = [widget]
    const next = { canvas: { w: 4, h: 4 }, layers: [] }

    setCompositorWidgetValue(node, next)

    expect(widget.value).toEqual(next)
    expect(getCompositorWidgetValue(node)).toEqual(next)
  })

  it('is a no-op when the widget exists nowhere', () => {
    const node = makeNode({ registered: false })

    setCompositorWidgetValue(node, { layers: [] })

    expect(storedValue(node)).toBeUndefined()
  })
})

describe('getCompositorWidgetValue', () => {
  it('returns the widget value when it has the expected shape', () => {
    const node = makeNode()

    expect(getCompositorWidgetValue(node)).toEqual({ layers: [] })
  })

  it('returns null for missing widgets or malformed values', () => {
    const node = makeNode()
    useWidgetValueStore().setValue(
      widgetId(GRAPH_ID, node.id, 'compositor'),
      'legacy-string'
    )
    expect(getCompositorWidgetValue(node)).toBeNull()

    expect(getCompositorWidgetValue(makeNode({ registered: false }))).toBeNull()
  })

  it('does not fall back to a stale widget object over a nullish store value', () => {
    const node = makeNode()
    node.widgets = [
      fromPartial<ICompositorWidget>({
        name: 'compositor',
        type: 'compositor',
        value: { layers: [] }
      })
    ]
    useWidgetValueStore().setValue(
      widgetId(GRAPH_ID, node.id, 'compositor'),
      null
    )

    expect(getCompositorWidgetValue(node)).toBeNull()
  })
})

describe('resetCompositorStateWidgets', () => {
  it('resets the compositor widget to the empty value durably', () => {
    const node = makeNode()
    setCompositorWidgetValue(node, { canvas: { w: 8, h: 8 }, layers: [] })

    resetCompositorStateWidgets(node)

    expect(storedValue(node)).toEqual({})
  })
})
