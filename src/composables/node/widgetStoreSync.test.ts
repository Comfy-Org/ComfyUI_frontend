import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  nodeWidgetValue,
  setNodeWidgetValue,
  watchNodeWidgetValues
} from '@/composables/node/widgetStoreSync'
import { fromPartial } from '@total-typescript/shoehorn'

import { CustomEventTarget } from '@/lib/litegraph/src/infrastructure/CustomEventTarget'
import type { LGraphEventMap } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

const GRAPH_ID = 'widget-store-sync-graph'

function makeNode(id: NodeId): LGraphNode {
  return createMockLGraphNode({
    id,
    graph: {
      rootGraph: { id: GRAPH_ID },
      events: new CustomEventTarget<LGraphEventMap>()
    }
  })
}

function registerNumberWidget(nodeId: NodeId, name: string, value: number) {
  useWidgetValueStore().registerWidget(widgetId(GRAPH_ID, nodeId, name), {
    type: 'number',
    value,
    options: {}
  })
}

describe('watchNodeWidgetValues', () => {
  it('fires with the current values when a watched store value changes', async () => {
    const nodeId = toNodeId(1)
    const node = makeNode(nodeId)
    registerNumberWidget(nodeId, 'width', 1024)
    registerNumberWidget(nodeId, 'height', 768)
    const onChange = vi.fn()

    watchNodeWidgetValues(node, 'target-size', ['width', 'height'], onChange)
    useWidgetValueStore().setValue(widgetId(GRAPH_ID, nodeId, 'width'), 2048)
    await nextTick()

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith([2048, 768])
  })

  it('does not fire when the same value is written again', async () => {
    const nodeId = toNodeId(2)
    const node = makeNode(nodeId)
    registerNumberWidget(nodeId, 'width', 1024)
    const onChange = vi.fn()

    watchNodeWidgetValues(node, 'target-size', ['width'], onChange)
    useWidgetValueStore().setValue(widgetId(GRAPH_ID, nodeId, 'width'), 1024)
    await nextTick()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('replaces the previous watcher when the same (node, key) is re-registered', async () => {
    const nodeId = toNodeId(3)
    const node = makeNode(nodeId)
    registerNumberWidget(nodeId, 'width', 100)
    const first = vi.fn()
    const second = vi.fn()

    watchNodeWidgetValues(node, 'target-size', ['width'], first)
    watchNodeWidgetValues(node, 'target-size', ['width'], second)
    useWidgetValueStore().setValue(widgetId(GRAPH_ID, nodeId, 'width'), 200)
    await nextTick()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith([200])
  })

  it('stops all watchers when the graph removes the node', async () => {
    const nodeId = toNodeId(4)
    const events = new CustomEventTarget<LGraphEventMap>()
    const node = createMockLGraphNode({
      id: nodeId,
      graph: { rootGraph: { id: GRAPH_ID }, events }
    })
    registerNumberWidget(nodeId, 'width', 100)
    registerNumberWidget(nodeId, 'height', 100)
    const onWidthChange = vi.fn()
    const onHeightChange = vi.fn()

    watchNodeWidgetValues(node, 'width-sync', ['width'], onWidthChange)
    watchNodeWidgetValues(node, 'height-sync', ['height'], onHeightChange)
    events.dispatch('node:before-removed', { node })
    useWidgetValueStore().setValue(widgetId(GRAPH_ID, nodeId, 'width'), 200)
    useWidgetValueStore().setValue(widgetId(GRAPH_ID, nodeId, 'height'), 200)
    await nextTick()

    expect(onWidthChange).not.toHaveBeenCalled()
    expect(onHeightChange).not.toHaveBeenCalled()
  })

  it('yields undefined for unregistered widget names without throwing', async () => {
    const nodeId = toNodeId(5)
    const node = makeNode(nodeId)
    registerNumberWidget(nodeId, 'width', 100)
    const onChange = vi.fn()

    watchNodeWidgetValues(node, 'target-size', ['width', 'missing'], onChange)
    useWidgetValueStore().setValue(widgetId(GRAPH_ID, nodeId, 'width'), 200)
    await nextTick()

    expect(onChange).toHaveBeenCalledWith([200, undefined])
  })
})

describe('deferred wiring', () => {
  it('defers via onAdded when the node has no graph yet, then fires normally', async () => {
    const nodeId = toNodeId(8)
    const node = createMockLGraphNode({ id: nodeId })
    const onChange = vi.fn()

    watchNodeWidgetValues(node, 'target-size', ['width'], onChange)
    registerNumberWidget(nodeId, 'width', 100)
    useWidgetValueStore().setValue(widgetId(GRAPH_ID, nodeId, 'width'), 200)
    await nextTick()
    expect(onChange).not.toHaveBeenCalled()

    node.graph = fromPartial({ rootGraph: { id: GRAPH_ID } })
    node.onAdded?.(fromPartial({}))
    useWidgetValueStore().setValue(widgetId(GRAPH_ID, nodeId, 'width'), 300)
    await nextTick()

    expect(onChange).toHaveBeenCalledWith([300])
  })
})

describe('setNodeWidgetValue', () => {
  it('reports whether the widget exists and skips same-value writes', () => {
    const nodeId = toNodeId(9)
    const node = makeNode(nodeId)
    registerNumberWidget(nodeId, 'width', 100)

    expect(setNodeWidgetValue(node, 'width', 100)).toBe(true)
    expect(setNodeWidgetValue(node, 'width', 200)).toBe(true)
    expect(
      useWidgetValueStore().getWidget(widgetId(GRAPH_ID, nodeId, 'width'))
        ?.value
    ).toBe(200)
    expect(setNodeWidgetValue(node, 'missing', 1)).toBe(false)
  })
})

describe('nodeWidgetValue', () => {
  it('reads the current store value for a registered widget', () => {
    const nodeId = toNodeId(6)
    const node = makeNode(nodeId)
    registerNumberWidget(nodeId, 'width', 512)

    expect(nodeWidgetValue(node, 'width')).toBe(512)
  })

  it('returns undefined for a node without a graph', () => {
    const node = createMockLGraphNode({ id: toNodeId(7) })

    expect(nodeWidgetValue(node, 'width')).toBeUndefined()
  })
})
