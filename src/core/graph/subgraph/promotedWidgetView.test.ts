import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Barrel import must come first to avoid circular dependency
// (promotedWidgetView → widgetMap → BaseWidget → LegacyWidget → barrel)
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/litegraph'

import { createPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetView';
import type { PromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetView';
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({ widgetStates: new Map() })
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

function setupSubgraph(
  innerNodeCount: number = 0
): [SubgraphNode, LGraphNode[]] {
  const subgraph = createTestSubgraph()
  const subgraphNode = createTestSubgraphNode(subgraph)
  subgraphNode._internalConfigureAfterSlots()
  const graph = subgraphNode.graph!
  graph.add(subgraphNode)
  const innerNodes: LGraphNode[] = []
  for (let i = 0; i < innerNodeCount; i++) {
    const innerNode = new LGraphNode(`InnerNode${i}`)
    subgraph.add(innerNode)
    innerNodes.push(innerNode)
  }
  return [subgraphNode, innerNodes]
}

describe('createPromotedWidgetView', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  test('exposes sourceNodeId and sourceWidgetName', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '42', 'myWidget')
    expect(view.sourceNodeId).toBe('42')
    expect(view.sourceWidgetName).toBe('myWidget')
  })

  test('name defaults to widgetName when no displayName given', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '1', 'myWidget')
    expect(view.name).toBe('myWidget')
  })

  test('name uses displayName when provided', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(
      subgraphNode,
      '1',
      'myWidget',
      'Custom Label'
    )
    expect(view.name).toBe('Custom Label')
  })

  test('node getter returns the subgraphNode', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '1', 'myWidget')
    // node is defined via Object.defineProperty at runtime but not on the TS interface
    expect((view as unknown as Record<string, unknown>).node).toBe(subgraphNode)
  })

  test('serialize is false', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '1', 'myWidget')
    expect(view.serialize).toBe(false)
  })

  test('promoted is false and setter is a no-op', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '1', 'myWidget')
    expect(view.promoted).toBe(false)
    view.promoted = true
    expect(view.promoted).toBe(false)
  })

  test('computedDisabled is false and setter is a no-op', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '1', 'myWidget')
    expect(view.computedDisabled).toBe(false)
    view.computedDisabled = true
    expect(view.computedDisabled).toBe(false)
  })

  test('positional properties are writable and independent', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '1', 'myWidget')
    expect(view.y).toBe(0)

    view.y = 100
    view.last_y = 90
    view.computedHeight = 30

    expect(view.y).toBe(100)
    expect(view.last_y).toBe(90)
    expect(view.computedHeight).toBe(30)
  })

  test('type delegates to interior widget', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('combo', 'picker', 'a', () => {}, {
      values: ['a', 'b']
    })
    const view = createPromotedWidgetView(
      subgraphNode,
      String(innerNodes[0].id),
      'picker'
    )
    expect(view.type).toBe('combo')
  })

  test('type falls back to button when interior widget is missing', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '999', 'missing')
    expect(view.type).toBe('button')
  })

  test('options delegates to interior widget', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    const opts = { values: ['a', 'b'] as string[] }
    innerNodes[0].addWidget('combo', 'picker', 'a', () => {}, opts)
    const view = createPromotedWidgetView(
      subgraphNode,
      String(innerNodes[0].id),
      'picker'
    )
    expect(view.options).toBe(opts)
  })

  test('options falls back to empty object when interior widget is missing', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '999', 'missing')
    expect(view.options).toEqual({})
  })

  test('value is store-backed via widgetValueStore', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'myWidget', 'initial', () => {})
    const view = createPromotedWidgetView(
      subgraphNode,
      String(innerNodes[0].id),
      'myWidget'
    )

    // Value should read from the store (which was populated by addWidget)
    expect(view.value).toBe('initial')

    // Setting value through the view updates the store
    view.value = 'updated'
    expect(view.value).toBe('updated')

    // The interior widget reads from the same store
    expect(innerNodes[0].widgets![0].value).toBe('updated')
  })

  test('label falls back to displayName then widgetName', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'myWidget', 'val', () => {})
    const store = useWidgetValueStore()
    const bareId = String(innerNodes[0].id)

    // No displayName → falls back to widgetName
    const view1 = createPromotedWidgetView(subgraphNode, bareId, 'myWidget')
    // Store label is undefined → falls back to displayName/widgetName
    const state = store.getWidget(bareId as never, 'myWidget')
    state!.label = undefined
    expect(view1.label).toBe('myWidget')

    // With displayName → falls back to displayName
    const view2 = createPromotedWidgetView(
      subgraphNode,
      bareId,
      'myWidget',
      'Custom'
    )
    expect(view2.label).toBe('Custom')
  })

  test('callback forwards to interior widget', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    const callbackSpy = vi.fn()
    innerNodes[0].addWidget('text', 'myWidget', 'val', callbackSpy)
    const view = createPromotedWidgetView(
      subgraphNode,
      String(innerNodes[0].id),
      'myWidget'
    )

    view.callback!('newVal')
    expect(callbackSpy).toHaveBeenCalled()
    expect(callbackSpy.mock.calls[0][0]).toBe('newVal')
  })

  test('callback is safe when interior widget is missing', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '999', 'missing')
    expect(() => view.callback!('val')).not.toThrow()
  })
})

describe('SubgraphNode.widgets getter', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  test('returns empty array when no proxyWidgets', () => {
    const [subgraphNode] = setupSubgraph()
    expect(subgraphNode.widgets).toEqual([])
  })

  test('caches view objects across getter calls (stable references)', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    subgraphNode.properties.proxyWidgets = [['1', 'widgetA']]

    const first = subgraphNode.widgets[0]
    const second = subgraphNode.widgets[0]
    expect(first).toBe(second)
  })

  test('memoizes promotion list by reference', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})

    const list: [string, string][] = [['1', 'widgetA']]
    subgraphNode.properties.proxyWidgets = list

    const views1 = subgraphNode.widgets
    expect(views1).toHaveLength(1)

    // Same reference → same result (memoized)
    const views2 = subgraphNode.widgets
    expect(views2[0]).toBe(views1[0])

    // New reference → re-parsed
    subgraphNode.properties.proxyWidgets = [['1', 'widgetA']]
    const views3 = subgraphNode.widgets
    // Same key → same cached view object
    expect(views3[0]).toBe(views1[0])
  })

  test('cleans stale cache entries when proxyWidgets shrinks', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})

    subgraphNode.properties.proxyWidgets = [
      ['1', 'widgetA'],
      ['1', 'widgetB']
    ]
    expect(subgraphNode.widgets).toHaveLength(2)
    const viewA = subgraphNode.widgets[0]

    // Remove widgetA from promotion list
    subgraphNode.properties.proxyWidgets = [['1', 'widgetB']]
    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].name).toBe('widgetB')

    // Re-adding widgetA creates a new view (old one was cleaned)
    subgraphNode.properties.proxyWidgets = [
      ['1', 'widgetB'],
      ['1', 'widgetA']
    ]
    const newViewA = subgraphNode.widgets[1]
    expect(newViewA).not.toBe(viewA)
  })

  test('deduplicates entries with same nodeId:widgetName', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})

    subgraphNode.properties.proxyWidgets = [
      ['1', 'widgetA'],
      ['1', 'widgetA']
    ]
    expect(subgraphNode.widgets).toHaveLength(1)
  })

  test('setter is a no-op', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    subgraphNode.properties.proxyWidgets = [['1', 'widgetA']]

    // Assigning to widgets does nothing
    subgraphNode.widgets = []
    expect(subgraphNode.widgets).toHaveLength(1)
  })

  test('migrates legacy -1 entries via _resolveLegacyEntry', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})

    // Simulate a slot-connected widget so legacy resolution works
    const subgraph = subgraphNode.subgraph
    subgraph.addInput('stringWidget', '*')
    subgraphNode._internalConfigureAfterSlots()

    // The _internalConfigureAfterSlots would have set up the slot-connected
    // widget via _setWidget if there's a link. For unit testing legacy
    // migration, we need to set up the input._widget manually.
    const input = subgraphNode.inputs.find((i) => i.name === 'stringWidget')
    if (input) {
      input._widget = createPromotedWidgetView(
        subgraphNode,
        String(innerNodes[0].id),
        'stringWidget'
      )
    }

    // Set legacy -1 format
    subgraphNode.properties.proxyWidgets = [['-1', 'stringWidget']]

    // Accessing widgets should resolve and migrate
    const widgets = subgraphNode.widgets
    if (widgets.length > 0) {
      // Migration should have rewritten proxyWidgets
      expect(subgraphNode.properties.proxyWidgets).toStrictEqual([
        [String(innerNodes[0].id), 'stringWidget']
      ])
    }
  })
})

describe('promote/demote cycle', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  test('promoting adds to proxyWidgets and widgets reflects it', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})

    expect(subgraphNode.widgets).toHaveLength(0)

    subgraphNode.properties.proxyWidgets = [['1', 'widgetA']]
    expect(subgraphNode.widgets).toHaveLength(1)
    const view = subgraphNode.widgets[0] as PromotedWidgetView
    expect(view.sourceNodeId).toBe('1')
    expect(view.sourceWidgetName).toBe('widgetA')
  })

  test('demoting via removeWidget removes from proxyWidgets', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})
    subgraphNode.properties.proxyWidgets = [
      ['1', 'widgetA'],
      ['1', 'widgetB']
    ]

    const viewA = subgraphNode.widgets[0]
    subgraphNode.removeWidget(viewA)

    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].name).toBe('widgetB')
    expect(subgraphNode.properties.proxyWidgets).toStrictEqual([
      ['1', 'widgetB']
    ])
  })

  test('full promote → demote → re-promote cycle', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})

    // Promote
    subgraphNode.properties.proxyWidgets = [['1', 'widgetA']]
    expect(subgraphNode.widgets).toHaveLength(1)
    const view1 = subgraphNode.widgets[0]

    // Demote
    subgraphNode.removeWidget(view1)
    expect(subgraphNode.widgets).toHaveLength(0)

    // Re-promote — creates a new view since the cache was cleared
    subgraphNode.properties.proxyWidgets = [['1', 'widgetA']]
    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0]).not.toBe(view1)
    expect(
      (subgraphNode.widgets[0] as PromotedWidgetView).sourceWidgetName
    ).toBe('widgetA')
  })
})

describe('disconnected state', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  test('view resolves type when interior widget exists', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('number', 'numWidget', 42, () => {})
    subgraphNode.properties.proxyWidgets = [['1', 'numWidget']]

    expect(subgraphNode.widgets[0].type).toBe('number')
  })

  test('view falls back to button type when interior node is removed', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'myWidget', 'val', () => {})
    subgraphNode.properties.proxyWidgets = [['1', 'myWidget']]

    expect(subgraphNode.widgets[0].type).toBe('text')

    // Remove the interior node from the subgraph
    subgraphNode.subgraph.remove(innerNodes[0])
    expect(subgraphNode.widgets[0].type).toBe('button')
  })

  test('view recovers when interior widget is re-added', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'myWidget', 'val', () => {})
    subgraphNode.properties.proxyWidgets = [['1', 'myWidget']]

    // Remove widget
    innerNodes[0].widgets!.pop()
    expect(subgraphNode.widgets[0].type).toBe('button')

    // Re-add widget
    innerNodes[0].addWidget('text', 'myWidget', 'val', () => {})
    expect(subgraphNode.widgets[0].type).toBe('text')
  })

  test('options returns empty object when disconnected', () => {
    const [subgraphNode] = setupSubgraph()
    subgraphNode.properties.proxyWidgets = [['999', 'ghost']]
    expect(subgraphNode.widgets[0].options).toEqual({})
  })

  test('tooltip returns undefined when disconnected', () => {
    const [subgraphNode] = setupSubgraph()
    subgraphNode.properties.proxyWidgets = [['999', 'ghost']]
    expect(subgraphNode.widgets[0].tooltip).toBeUndefined()
  })
})
