import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { getWidgetIds } from '@/lib/litegraph/src/utils/widget'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { zeroUuid } from '@/utils/uuid'

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

  it('drops the widget order a removed node registered, keeping its values', () => {
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
    expect(widgetValueStore.getWidget(widgetId)?.value).toBe('a value')
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

  it('releases widget and exposure entries when a zero-uuid root graph is cleared', () => {
    const graph = new LGraph()
    expect(graph.id).toBe(zeroUuid)

    const node = addWidgetedNode(graph)
    const [widgetId] = widgetIdsOf(node)
    const hostLocator = String(node.id)
    const previewExposureStore = usePreviewExposureStore()
    previewExposureStore.addExposure(graph.id, hostLocator, {
      sourceNodeId: 1,
      sourcePreviewName: 'images'
    })
    const widgetValueStore = useWidgetValueStore()

    graph.clear()

    expect(widgetValueStore.getNodeWidgetIds(zeroUuid, node.id)).toEqual([])
    expect(widgetValueStore.getWidget(widgetId)).toBeUndefined()
    expect(previewExposureStore.getExposures(zeroUuid, hostLocator)).toEqual([])
  })
})
