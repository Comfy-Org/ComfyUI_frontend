import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import {
  getNodeWidgetValue,
  nodeWidgetId,
  setNodeWidgetValue
} from './nodeWidgetValues'

const GRAPH_ID = 'node-widget-values-test'
const WIDGET_NAME = 'image'

function makeRegisteredNode(value = 'registered.png'): LGraphNode {
  const graph = new LGraph()
  const node = new LGraphNode('Test')
  graph.add(node)
  node.addWidget('string', WIDGET_NAME, value, () => undefined)
  return node
}

function registeredId(node: LGraphNode) {
  const id = node.widgets?.[0].widgetId
  if (!id) throw new Error('Expected a registered widget')
  return id
}

function makeMockNode({
  registered = false,
  widgetValue = 'legacy.png'
}: { registered?: boolean; widgetValue?: string } = {}): LGraphNode {
  const nodeId = toNodeId(1)
  if (registered) {
    useWidgetValueStore().registerWidget(
      widgetId(GRAPH_ID, nodeId, WIDGET_NAME),
      { type: 'string', value: 'stored.png', options: {} }
    )
  }
  const node = createMockLGraphNode({
    id: nodeId,
    graph: { rootGraph: { id: GRAPH_ID } }
  })
  node.widgets = [
    fromPartial<IBaseWidget>({
      name: WIDGET_NAME,
      type: 'string',
      value: widgetValue
    })
  ]
  return node
}

describe('nodeWidgetId', () => {
  it('matches the id a registered widget derives for itself', () => {
    const node = makeRegisteredNode()

    expect(nodeWidgetId(node, WIDGET_NAME)).toBe(registeredId(node))
  })

  it('returns null for a node outside any graph', () => {
    const node = new LGraphNode('Test')

    expect(nodeWidgetId(node, WIDGET_NAME)).toBeNull()
  })
})

describe('getNodeWidgetValue', () => {
  it('reads the store value for a registered widget', () => {
    const node = makeRegisteredNode()
    useWidgetValueStore().setValue(registeredId(node), 'updated.png')

    expect(getNodeWidgetValue(node, WIDGET_NAME)).toBe('updated.png')
  })

  it('preserves a nullish store value instead of falling back', () => {
    const node = makeMockNode({ registered: true, widgetValue: 'stale.png' })
    useWidgetValueStore().setValue(
      widgetId(GRAPH_ID, node.id, WIDGET_NAME),
      null
    )

    expect(getNodeWidgetValue(node, WIDGET_NAME)).toBeNull()
  })

  it('falls back to the widget object when the store has no entry', () => {
    const node = makeMockNode({ widgetValue: 'legacy.png' })

    expect(getNodeWidgetValue(node, WIDGET_NAME)).toBe('legacy.png')
  })

  it('reads the widget object on a node outside any graph', () => {
    const node = new LGraphNode('Test')
    node.addWidget('string', WIDGET_NAME, 'detached.png', () => undefined)

    expect(getNodeWidgetValue(node, WIDGET_NAME)).toBe('detached.png')
  })
})

describe('setNodeWidgetValue', () => {
  it('writes the store value for a registered widget', () => {
    const node = makeRegisteredNode()

    expect(setNodeWidgetValue(node, WIDGET_NAME, 'next.png')).toBe(true)
    expect(useWidgetValueStore().getWidget(registeredId(node))?.value).toBe(
      'next.png'
    )
  })

  it('falls back to the widget object when the store has no entry', () => {
    const node = makeMockNode({ widgetValue: 'legacy.png' })

    expect(setNodeWidgetValue(node, WIDGET_NAME, 'next.png')).toBe(true)
    expect(node.widgets?.[0].value).toBe('next.png')
  })

  it('returns false when the widget exists nowhere', () => {
    const node = createMockLGraphNode({
      id: toNodeId(1),
      graph: { rootGraph: { id: GRAPH_ID } }
    })

    expect(setNodeWidgetValue(node, WIDGET_NAME, 'next.png')).toBe(false)
  })
})
