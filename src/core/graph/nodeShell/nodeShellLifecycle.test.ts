import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { getWidgetIds } from '@/lib/litegraph/src/utils/widget'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

describe('node shell registration', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('remints a colliding node id and warns with both ids', () => {
    const graph = new LGraph()
    const first = new LGraphNode('first')
    graph.add(first)
    const duplicate = new LGraphNode('duplicate')
    duplicate.id = first.id
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    graph.add(duplicate)

    expect(duplicate.id).not.toBe(first.id)
    expect(graph.getNodeById(first.id)).toBe(first)
    expect(graph.getNodeById(duplicate.id)).toBe(duplicate)
    expect(
      useNodeDataStore()
        .getGraphNodesFor(graph.id, graph.id)
        .map(({ id }) => id)
    ).toEqual([first.id, duplicate.id])
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain(`Node id ${first.id} `)
    expect(warn.mock.calls[0][0]).toContain(`reminted as ${duplicate.id}`)
  })
})

describe('node shell teardown', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function addWidgetedNode(graph: LGraph | Subgraph): LGraphNode {
    const node = new LGraphNode('Node')
    node.addWidget('text', 'prompt', 'a value', () => {})
    graph.add(node)
    return node
  }

  function widgetIdsOf(node: LGraphNode) {
    return getWidgetIds(node.widgets ?? [])
  }

  it('releases widget state owned by a removed node', () => {
    const subgraph = createTestSubgraph()
    const rootGraphId = subgraph.rootGraph.id
    const node = addWidgetedNode(subgraph)
    const [widgetId] = widgetIdsOf(node)
    const widgetValueStore = useWidgetValueStore()

    expect(widgetValueStore.getNodeWidgetIds(rootGraphId, node.id)).toEqual([
      widgetId
    ])

    subgraph.remove(node)

    expect(widgetValueStore.getNodeWidgetIds(rootGraphId, node.id)).toEqual([])
    expect(widgetValueStore.getWidget(widgetId)).toBeUndefined()
  })

  it('drops the preview exposures a removed host node owned', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    const hostNode = createTestSubgraphNode(subgraph)
    rootGraph.add(hostNode)
    const hostLocator = String(hostNode.id)
    const previewExposureStore = usePreviewExposureStore()
    previewExposureStore.addExposure(rootGraph.id, hostLocator, {
      sourceNodeId: 1,
      sourcePreviewName: 'images'
    })

    rootGraph.remove(hostNode)

    expect(
      previewExposureStore.getExposures(rootGraph.id, hostLocator)
    ).toEqual([])
  })

  it('releases widget and exposure entries when a root graph is cleared', () => {
    const graph = new LGraph()
    const graphId = graph.id

    const node = addWidgetedNode(graph)
    const [widgetId] = widgetIdsOf(node)
    const hostLocator = String(node.id)
    const previewExposureStore = usePreviewExposureStore()
    previewExposureStore.addExposure(graphId, hostLocator, {
      sourceNodeId: 1,
      sourcePreviewName: 'images'
    })
    const widgetValueStore = useWidgetValueStore()

    graph.clear()

    expect(widgetValueStore.getNodeWidgetIds(graphId, node.id)).toEqual([])
    expect(widgetValueStore.getWidget(widgetId)).toBeUndefined()
    expect(previewExposureStore.getExposures(graphId, hostLocator)).toEqual([])
  })

  it('releases entries of a widget the node dropped without unregistering', () => {
    const graph = new LGraph()
    const graphId = graph.id
    const node = addWidgetedNode(graph)
    const [widgetId] = widgetIdsOf(node)
    const widgetValueStore = useWidgetValueStore()
    node.widgets = []

    graph.clear()

    expect(widgetValueStore.getNodeWidgetIds(graphId, node.id)).toEqual([])
    expect(widgetValueStore.getWidget(widgetId)).toBeUndefined()
  })
})
