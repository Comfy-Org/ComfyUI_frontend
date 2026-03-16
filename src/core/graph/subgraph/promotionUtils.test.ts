import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  promoteWidget,
  demoteWidget,
  getWidgetName,
  pruneDisconnected
} from '@/core/graph/subgraph/promotionUtils'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { usePromotionStore } from '@/stores/promotionStore'

vi.mock('@sentry/vue', () => ({ addBreadcrumb: vi.fn() }))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({ widgetStates: new Map() })
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))
vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: () => ({ navigationStack: [] })
}))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: vi.fn() })
}))

function createPromotedWidgetStub(
  sourceNodeId: string,
  sourceWidgetName: string
): IBaseWidget {
  return {
    name: 'promoted-slot-name',
    type: 'number',
    value: 42,
    y: 0,
    options: {},
    sourceNodeId,
    sourceWidgetName
  } as IBaseWidget
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('promoteWidget', () => {
  test('uses node.id for normal widgets', () => {
    const subgraph = createTestSubgraph()
    const parent = createTestSubgraphNode(subgraph, { id: 10 })
    const node = { id: 42, title: 'Leaf', type: 'KSampler' }
    const widget: IBaseWidget = {
      name: 'seed',
      type: 'number',
      value: 0,
      y: 0,
      options: {}
    }

    promoteWidget(node, widget, [parent])

    const store = usePromotionStore()
    const entries = store.getPromotions(parent.rootGraph.id, parent.id)
    expect(entries).toHaveLength(1)
    expect(entries[0].interiorNodeId).toBe('42')
    expect(entries[0].widgetName).toBe('seed')
  })

  test('uses node.id (immediate interior) for PromotedWidgetView, not sourceNodeId', () => {
    const subgraph = createTestSubgraph()
    const parent = createTestSubgraphNode(subgraph, { id: 10 })
    const node = { id: 77, title: 'SubgraphNodeB', type: subgraph.id }
    const widget = createPromotedWidgetStub('999', 'deep_seed')

    promoteWidget(node, widget, [parent])

    const store = usePromotionStore()
    const entries = store.getPromotions(parent.rootGraph.id, parent.id)
    expect(entries).toHaveLength(1)
    expect(entries[0].interiorNodeId).toBe('77')
  })
})

describe('demoteWidget', () => {
  test('uses node.id (immediate interior) for PromotedWidgetView demote', () => {
    const subgraph = createTestSubgraph()
    const parent = createTestSubgraphNode(subgraph, { id: 10 })
    const store = usePromotionStore()

    store.promote(parent.rootGraph.id, parent.id, '77', 'promoted-slot-name')

    const node = { id: 77, title: 'SubgraphNodeB', type: subgraph.id }
    const widget = createPromotedWidgetStub('999', 'deep_seed')

    demoteWidget(node, widget, [parent])

    const entries = store.getPromotions(parent.rootGraph.id, parent.id)
    expect(entries).toHaveLength(0)
  })
})

describe('getWidgetName', () => {
  test('returns widget.name for normal widget', () => {
    const widget: IBaseWidget = {
      name: 'seed',
      type: 'number',
      value: 0,
      y: 0,
      options: {}
    }
    expect(getWidgetName(widget)).toBe('seed')
  })

  test('returns widget.name for PromotedWidgetView (not sourceWidgetName)', () => {
    const widget = createPromotedWidgetStub('999', 'deep_seed')
    expect(getWidgetName(widget)).toBe('promoted-slot-name')
  })
})

describe('pruneDisconnected', () => {
  test('keeps promotion entries referencing nodes present in the subgraph', () => {
    const subgraph = createTestSubgraph()
    const parent = createTestSubgraphNode(subgraph, { id: 10 })
    const store = usePromotionStore()

    const innerNode = new LGraphNode('InnerNode')
    innerNode.addWidget('number', 'value', 0, () => undefined)
    parent.subgraph.add(innerNode)

    store.promote(parent.rootGraph.id, parent.id, String(innerNode.id), 'value')

    pruneDisconnected(parent)

    const entries = store.getPromotions(parent.rootGraph.id, parent.id)
    expect(entries).toHaveLength(1)
    expect(entries[0].interiorNodeId).toBe(String(innerNode.id))
  })

  test('prunes promotion entries referencing nodes NOT in the subgraph', () => {
    const subgraph = createTestSubgraph()
    const parent = createTestSubgraphNode(subgraph, { id: 10 })
    const store = usePromotionStore()

    store.promote(parent.rootGraph.id, parent.id, 'nonexistent-999', 'seed')

    pruneDisconnected(parent)

    const entries = store.getPromotions(parent.rootGraph.id, parent.id)
    expect(entries).toHaveLength(0)
  })
})
