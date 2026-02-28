import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Barrel import must come first to avoid circular dependency
// (promotedWidgetView → widgetMap → BaseWidget → LegacyWidget → barrel)
import {
  CanvasPointer,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type {
  CanvasPointerEvent,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { createPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetView'
import type { PromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetView'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import { usePromotionStore } from '@/stores/promotionStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
const mockDomWidgetStore = vi.hoisted(() => ({
  widgetStates: new Map(),
  setPositionOverride: vi.fn(),
  clearPositionOverride: vi.fn()
}))
vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => mockDomWidgetStore
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

function setPromotions(
  subgraphNode: SubgraphNode,
  entries: [string, string][]
) {
  usePromotionStore().setPromotions(
    subgraphNode.rootGraph.id,
    subgraphNode.id,
    entries.map(([interiorNodeId, widgetName]) => ({
      interiorNodeId,
      widgetName
    }))
  )
}

function firstInnerNode(innerNodes: LGraphNode[]): LGraphNode {
  const innerNode = innerNodes[0]
  if (!innerNode) throw new Error('Expected at least one inner node')
  return innerNode
}

describe(createPromotedWidgetView, () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockDomWidgetStore.widgetStates.clear()
    vi.clearAllMocks()
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

  test('computedDisabled defaults to false and accepts boolean values', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '1', 'myWidget')
    expect(view.computedDisabled).toBe(false)
    view.computedDisabled = true
    expect(view.computedDisabled).toBe(true)
  })

  test('computedDisabled treats undefined as false', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '1', 'myWidget')
    view.computedDisabled = true
    view.computedDisabled = undefined
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
    const innerNode = firstInnerNode(innerNodes)
    innerNode.addWidget('combo', 'picker', 'a', () => {}, {
      values: ['a', 'b']
    })
    const view = createPromotedWidgetView(
      subgraphNode,
      String(innerNode.id),
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
    const innerNode = firstInnerNode(innerNodes)
    const opts = { values: ['a', 'b'] as string[] }
    innerNode.addWidget('combo', 'picker', 'a', () => {}, opts)
    const view = createPromotedWidgetView(
      subgraphNode,
      String(innerNode.id),
      'picker'
    )
    expect(view.options).toBe(opts)
  })

  test('options falls back to empty object when interior widget is missing', () => {
    const [subgraphNode] = setupSubgraph()
    const view = createPromotedWidgetView(subgraphNode, '999', 'missing')
    expect(view.options).toEqual({})
  })

  test('linkedWidgets delegates to interior widget', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    const innerNode = firstInnerNode(innerNodes)
    const seedWidget = innerNode.addWidget('number', 'seed', 1, () => {})
    const controlWidget = innerNode.addWidget(
      'combo',
      'control_after_generate',
      'randomize',
      () => {},
      {
        values: ['fixed', 'increment', 'decrement', 'randomize']
      }
    )
    seedWidget.linkedWidgets = [controlWidget]

    const view = createPromotedWidgetView(
      subgraphNode,
      String(innerNode.id),
      'seed'
    )

    expect(view.linkedWidgets).toBe(seedWidget.linkedWidgets)
    expect(view.linkedWidgets?.[0].name).toBe('control_after_generate')
  })

  test('value is store-backed via widgetValueStore', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    const innerNode = firstInnerNode(innerNodes)
    innerNode.addWidget('text', 'myWidget', 'initial', () => {})
    const view = createPromotedWidgetView(
      subgraphNode,
      String(innerNode.id),
      'myWidget'
    )

    // Value should read from the store (which was populated by addWidget)
    expect(view.value).toBe('initial')

    // Setting value through the view updates the store
    view.value = 'updated'
    expect(view.value).toBe('updated')

    // The interior widget reads from the same store
    expect(innerNode.widgets![0].value).toBe('updated')
  })

  test('value falls back to interior widget when store entry is missing', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    const innerNode = firstInnerNode(innerNodes)
    const fallbackWidgetShape = {
      name: 'myWidget',
      type: 'text',
      value: 'initial',
      options: {}
    } satisfies Pick<IBaseWidget, 'name' | 'type' | 'value' | 'options'>
    const fallbackWidget = fallbackWidgetShape as unknown as IBaseWidget
    innerNode.widgets = [fallbackWidget]

    const widgetValueStore = useWidgetValueStore()
    vi.spyOn(widgetValueStore, 'getWidget').mockReturnValue(undefined)

    const view = createPromotedWidgetView(
      subgraphNode,
      String(innerNode.id),
      'myWidget'
    )

    expect(view.value).toBe('initial')
    view.value = 'updated'
    expect(fallbackWidget.value).toBe('updated')
  })

  test('label falls back to displayName then widgetName', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    const innerNode = firstInnerNode(innerNodes)
    innerNode.addWidget('text', 'myWidget', 'val', () => {})
    const store = useWidgetValueStore()
    const bareId = String(innerNode.id)

    // No displayName → falls back to widgetName
    const view1 = createPromotedWidgetView(subgraphNode, bareId, 'myWidget')
    // Store label is undefined → falls back to displayName/widgetName
    const state = store.getWidget(
      subgraphNode.rootGraph.id,
      bareId as never,
      'myWidget'
    )
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
    const innerNode = firstInnerNode(innerNodes)
    const callbackSpy = vi.fn()
    innerNode.addWidget('text', 'myWidget', 'val', callbackSpy)
    const view = createPromotedWidgetView(
      subgraphNode,
      String(innerNode.id),
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

  test('computeSize delegates to interior widget computeSize', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    const innerNode = firstInnerNode(innerNodes)
    const widget = innerNode.addWidget('text', 'legacySize', 'val', () => {})
    const computeSize = vi.fn<(width?: number) => [number, number]>(
      (width?: number) => [width ?? 0, 37]
    )
    widget.computeSize = computeSize

    const view = createPromotedWidgetView(
      subgraphNode,
      String(innerNode.id),
      'legacySize'
    )

    expect(typeof view.computeSize).toBe('function')
    expect(view.computeSize?.(210)).toEqual([210, 37])
    expect(computeSize).toHaveBeenCalledWith(210)
  })

  test('onPointerDown falls back to legacy mouse callback', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    subgraphNode.pos = [10, 20]
    const innerNode = firstInnerNode(innerNodes)
    const mouse = vi.fn(() => true)
    const legacyWidget = {
      name: 'legacyMouse',
      type: 'mystery-legacy',
      value: 'val',
      options: {},
      mouse
    } as unknown as IBaseWidget
    innerNode.widgets = [legacyWidget]

    const view = createPromotedWidgetView(
      subgraphNode,
      String(innerNode.id),
      'legacyMouse'
    )

    const pointer = new CanvasPointer(document.createElement('div'))
    pointer.eDown = {
      canvasX: 110,
      canvasY: 120,
      deltaX: 0,
      deltaY: 0,
      safeOffsetX: 0,
      safeOffsetY: 0
    } as CanvasPointerEvent

    const handled = view.onPointerDown?.(
      pointer,
      subgraphNode,
      {} as Parameters<NonNullable<typeof view.onPointerDown>>[2]
    )

    expect(handled).toBe(true)
    expect(mouse).toHaveBeenCalledWith(pointer.eDown, [100, 100], subgraphNode)

    pointer.eUp = {
      canvasX: 130,
      canvasY: 140,
      deltaX: 0,
      deltaY: 0,
      safeOffsetX: 0,
      safeOffsetY: 0
    } as CanvasPointerEvent
    pointer.finally?.()

    expect(mouse).toHaveBeenCalledWith(pointer.eUp, [120, 120], subgraphNode)
  })
})

describe('SubgraphNode.widgets getter', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  test('defers promotions while subgraph node id is -1 and flushes on add', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'picker_input', type: '*' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph, { id: -1 })

    const innerNode = new LGraphNode('InnerNode')
    const innerInput = innerNode.addInput('picker_input', '*')
    innerNode.addWidget('combo', 'picker', 'a', () => {}, {
      values: ['a', 'b']
    })
    innerInput.widget = { name: 'picker' }
    subgraph.add(innerNode)

    subgraph.inputNode.slots[0].connect(innerInput, innerNode)
    subgraphNode._internalConfigureAfterSlots()

    const store = usePromotionStore()
    expect(store.getPromotions(subgraphNode.rootGraph.id, -1)).toStrictEqual([])

    subgraphNode.graph?.add(subgraphNode)
    expect(subgraphNode.id).not.toBe(-1)
    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toStrictEqual([
      {
        interiorNodeId: String(innerNode.id),
        widgetName: 'picker'
      }
    ])
  })

  test('rebinds one input to latest source without stale disconnected views', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'picker_input', type: '*' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph, { id: 41 })
    subgraphNode.graph?.add(subgraphNode)

    const firstNode = new LGraphNode('FirstNode')
    const firstInput = firstNode.addInput('picker_input', '*')
    firstNode.addWidget('combo', 'picker', 'a', () => {}, {
      values: ['a', 'b']
    })
    firstInput.widget = { name: 'picker' }
    subgraph.add(firstNode)
    const subgraphInputSlot = subgraph.inputNode.slots[0]
    subgraphInputSlot.connect(firstInput, firstNode)

    // Mirror user-driven rebind behavior: move the slot connection from first
    // source to second source, rather than keeping both links connected.
    subgraphInputSlot.disconnect()

    const secondNode = new LGraphNode('SecondNode')
    const secondInput = secondNode.addInput('picker_input', '*')
    secondNode.addWidget('combo', 'picker', 'b', () => {}, {
      values: ['a', 'b']
    })
    secondInput.widget = { name: 'picker' }
    subgraph.add(secondNode)
    subgraphInputSlot.connect(secondInput, secondNode)

    const promotions = usePromotionStore().getPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id
    )

    expect(promotions).toHaveLength(1)
    expect(promotions[0]).toStrictEqual({
      interiorNodeId: String(secondNode.id),
      widgetName: 'picker'
    })
    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].value).toBe('b')
  })

  test('preserves distinct promoted display names when two inputs share one concrete widget name', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'strength_model', type: '*' },
        { name: 'strength_model_1', type: '*' }
      ]
    })
    const subgraphNode = createTestSubgraphNode(subgraph, { id: 90 })
    subgraphNode.graph?.add(subgraphNode)

    const innerNode = new LGraphNode('InnerNumberNode')
    const firstInput = innerNode.addInput('strength_model', '*')
    const secondInput = innerNode.addInput('strength_model_1', '*')
    innerNode.addWidget('number', 'strength_model', 1, () => {})
    firstInput.widget = { name: 'strength_model' }
    secondInput.widget = { name: 'strength_model' }
    subgraph.add(innerNode)

    subgraph.inputNode.slots[0].connect(firstInput, innerNode)
    subgraph.inputNode.slots[1].connect(secondInput, innerNode)

    expect(subgraphNode.widgets).toHaveLength(2)
    expect(subgraphNode.widgets.map((widget) => widget.name)).toStrictEqual([
      'strength_model',
      'strength_model_1'
    ])
  })

  test('returns empty array when no proxyWidgets', () => {
    const [subgraphNode] = setupSubgraph()
    expect(subgraphNode.widgets).toEqual([])
  })

  test('widgets getter prefers live linked entries over stale store entries', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'widgetA', type: '*' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph, { id: 91 })
    subgraphNode.graph?.add(subgraphNode)

    const liveNode = new LGraphNode('LiveNode')
    const liveInput = liveNode.addInput('widgetA', '*')
    liveNode.addWidget('text', 'widgetA', 'a', () => {})
    liveInput.widget = { name: 'widgetA' }
    subgraph.add(liveNode)
    subgraph.inputNode.slots[0].connect(liveInput, liveNode)

    setPromotions(subgraphNode, [
      [String(liveNode.id), 'widgetA'],
      ['9999', 'missingWidget']
    ])

    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].name).toBe('widgetA')
  })

  test('partial linked coverage does not destructively prune unresolved store promotions', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'widgetA', type: '*' },
        { name: 'widgetB', type: '*' }
      ]
    })
    const subgraphNode = createTestSubgraphNode(subgraph, { id: 92 })
    subgraphNode.graph?.add(subgraphNode)

    const liveNode = new LGraphNode('LiveNode')
    const liveInput = liveNode.addInput('widgetA', '*')
    liveNode.addWidget('text', 'widgetA', 'a', () => {})
    liveInput.widget = { name: 'widgetA' }
    subgraph.add(liveNode)
    subgraph.inputNode.slots[0].connect(liveInput, liveNode)

    setPromotions(subgraphNode, [
      [String(liveNode.id), 'widgetA'],
      ['9999', 'widgetB']
    ])

    // Trigger widgets getter reconciliation in partial-linked state.
    void subgraphNode.widgets

    const promotions = usePromotionStore().getPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id
    )
    expect(promotions).toStrictEqual([
      { interiorNodeId: String(liveNode.id), widgetName: 'widgetA' },
      { interiorNodeId: '9999', widgetName: 'widgetB' }
    ])
  })

  test('caches view objects across getter calls (stable references)', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    setPromotions(subgraphNode, [['1', 'widgetA']])

    const first = subgraphNode.widgets[0]
    const second = subgraphNode.widgets[0]
    expect(first).toBe(second)
  })

  test('memoizes promotion list by reference', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})

    setPromotions(subgraphNode, [['1', 'widgetA']])

    const views1 = subgraphNode.widgets
    expect(views1).toHaveLength(1)

    // Same reference → same result (memoized)
    const views2 = subgraphNode.widgets
    expect(views2[0]).toBe(views1[0])

    // New store value with same content → same cached view object
    setPromotions(subgraphNode, [['1', 'widgetA']])
    const views3 = subgraphNode.widgets
    expect(views3[0]).toBe(views1[0])
  })

  test('cleans stale cache entries when promotions shrink', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})

    setPromotions(subgraphNode, [
      ['1', 'widgetA'],
      ['1', 'widgetB']
    ])
    expect(subgraphNode.widgets).toHaveLength(2)
    const viewA = subgraphNode.widgets[0]

    // Remove widgetA from promotion list
    setPromotions(subgraphNode, [['1', 'widgetB']])
    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].name).toBe('widgetB')

    // Re-adding widgetA creates a new view (old one was cleaned)
    setPromotions(subgraphNode, [
      ['1', 'widgetB'],
      ['1', 'widgetA']
    ])
    const newViewA = subgraphNode.widgets[1]
    expect(newViewA).not.toBe(viewA)
  })

  test('deduplicates entries with same nodeId:widgetName', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})

    setPromotions(subgraphNode, [
      ['1', 'widgetA'],
      ['1', 'widgetA']
    ])
    expect(subgraphNode.widgets).toHaveLength(1)
  })

  test('setter is a no-op', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    setPromotions(subgraphNode, [['1', 'widgetA']])

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

    // Set legacy -1 format via properties and re-run hydration
    subgraphNode.properties.proxyWidgets = [['-1', 'stringWidget']]
    subgraphNode._internalConfigureAfterSlots()

    // Migration should have rewritten the store with resolved IDs
    const entries = usePromotionStore().getPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id
    )
    expect(entries).toStrictEqual([
      {
        interiorNodeId: String(innerNodes[0].id),
        widgetName: 'stringWidget'
      }
    ])
  })

  test('hydrate promotions from serialize/configure round-trip', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    const innerNode = firstInnerNode(innerNodes)
    innerNode.addWidget('text', 'widgetA', 'a', () => {})

    setPromotions(subgraphNode, [[String(innerNode.id), 'widgetA']])
    const serialized = subgraphNode.serialize()

    const restoredNode = createTestSubgraphNode(subgraphNode.subgraph, {
      id: 99
    })
    restoredNode.configure({
      ...serialized,
      id: restoredNode.id,
      type: subgraphNode.subgraph.id
    })

    const restoredEntries = usePromotionStore().getPromotions(
      restoredNode.rootGraph.id,
      restoredNode.id
    )
    expect(restoredEntries).toStrictEqual([
      {
        interiorNodeId: String(innerNode.id),
        widgetName: 'widgetA'
      }
    ])
  })

  test('clone output preserves proxyWidgets for promotion hydration', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    const innerNode = firstInnerNode(innerNodes)
    innerNode.addWidget('text', 'widgetA', 'a', () => {})

    setPromotions(subgraphNode, [[String(innerNode.id), 'widgetA']])

    const createNodeSpy = vi
      .spyOn(LiteGraph, 'createNode')
      .mockImplementation(() =>
        createTestSubgraphNode(subgraphNode.subgraph, { id: 999 })
      )

    const clonedNode = subgraphNode.clone()
    expect(clonedNode).toBeTruthy()
    createNodeSpy.mockRestore()
    if (!clonedNode) throw new Error('Expected clone to return a node')

    const clonedSerialized = clonedNode.serialize()
    expect(clonedSerialized.properties?.proxyWidgets).toStrictEqual([
      [String(innerNode.id), 'widgetA']
    ])

    const hydratedClone = createTestSubgraphNode(subgraphNode.subgraph, {
      id: 100
    })
    hydratedClone.configure({
      ...clonedSerialized,
      id: hydratedClone.id,
      type: subgraphNode.subgraph.id
    })

    const hydratedEntries = usePromotionStore().getPromotions(
      hydratedClone.rootGraph.id,
      hydratedClone.id
    )
    expect(hydratedEntries).toStrictEqual([
      {
        interiorNodeId: String(innerNode.id),
        widgetName: 'widgetA'
      }
    ])
  })
})

describe('widgets getter caching', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  test('preserves view identities when promotion order changes', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})
    setPromotions(subgraphNode, [
      ['1', 'widgetA'],
      ['1', 'widgetB']
    ])

    const [viewA, viewB] = subgraphNode.widgets

    setPromotions(subgraphNode, [
      ['1', 'widgetB'],
      ['1', 'widgetA']
    ])

    expect(subgraphNode.widgets[0]).toBe(viewB)
    expect(subgraphNode.widgets[1]).toBe(viewA)
  })

  test('deduplicates by key while preserving first-occurrence order', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})

    setPromotions(subgraphNode, [
      ['1', 'widgetB'],
      ['1', 'widgetA'],
      ['1', 'widgetB'],
      ['1', 'widgetA']
    ])

    expect(subgraphNode.widgets).toHaveLength(2)
    expect(subgraphNode.widgets[0].name).toBe('widgetB')
    expect(subgraphNode.widgets[1].name).toBe('widgetA')
  })

  test('returns same array reference when promotions unchanged', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    setPromotions(subgraphNode, [['1', 'widgetA']])

    const result1 = subgraphNode.widgets
    const result2 = subgraphNode.widgets
    expect(result1).toBe(result2)
  })

  test('returns new array after promotion change', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})
    setPromotions(subgraphNode, [['1', 'widgetA']])

    const result1 = subgraphNode.widgets

    setPromotions(subgraphNode, [
      ['1', 'widgetA'],
      ['1', 'widgetB']
    ])
    const result2 = subgraphNode.widgets

    expect(result1).not.toBe(result2)
    expect(result2).toHaveLength(2)
  })

  test('invalidates cache on removeWidget', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})
    setPromotions(subgraphNode, [
      ['1', 'widgetA'],
      ['1', 'widgetB']
    ])

    const result1 = subgraphNode.widgets
    expect(result1).toHaveLength(2)

    subgraphNode.removeWidget(result1[0])
    const result2 = subgraphNode.widgets
    expect(result2).toHaveLength(1)
    expect(result1).not.toBe(result2)
  })
})

describe('promote/demote cycle', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  test('promoting adds to store and widgets reflects it', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})

    expect(subgraphNode.widgets).toHaveLength(0)

    setPromotions(subgraphNode, [['1', 'widgetA']])
    expect(subgraphNode.widgets).toHaveLength(1)
    const view = subgraphNode.widgets[0] as PromotedWidgetView
    expect(view.sourceNodeId).toBe('1')
    expect(view.sourceWidgetName).toBe('widgetA')
  })

  test('demoting via removeWidget removes from store', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})
    setPromotions(subgraphNode, [
      ['1', 'widgetA'],
      ['1', 'widgetB']
    ])

    const viewA = subgraphNode.widgets[0]
    subgraphNode.removeWidget(viewA)

    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].name).toBe('widgetB')
    const entries = usePromotionStore().getPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id
    )
    expect(entries).toStrictEqual([
      { interiorNodeId: '1', widgetName: 'widgetB' }
    ])
  })

  test('full promote → demote → re-promote cycle', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})

    // Promote
    setPromotions(subgraphNode, [['1', 'widgetA']])
    expect(subgraphNode.widgets).toHaveLength(1)
    const view1 = subgraphNode.widgets[0]

    // Demote
    subgraphNode.removeWidget(view1)
    expect(subgraphNode.widgets).toHaveLength(0)

    // Re-promote — creates a new view since the cache was cleared
    setPromotions(subgraphNode, [['1', 'widgetA']])
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
    setPromotions(subgraphNode, [['1', 'numWidget']])

    expect(subgraphNode.widgets[0].type).toBe('number')
  })

  test('keeps promoted entry as disconnected when interior node is removed', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'myWidget', 'val', () => {})
    setPromotions(subgraphNode, [['1', 'myWidget']])

    expect(subgraphNode.widgets[0].type).toBe('text')

    // Remove the interior node from the subgraph
    subgraphNode.subgraph.remove(innerNodes[0])
    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].type).toBe('button')
  })

  test('view recovers when interior widget is re-added', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'myWidget', 'val', () => {})
    setPromotions(subgraphNode, [['1', 'myWidget']])

    // Remove widget
    innerNodes[0].widgets!.pop()
    expect(subgraphNode.widgets[0].type).toBe('button')

    // Re-add widget
    innerNodes[0].addWidget('text', 'myWidget', 'val', () => {})
    expect(subgraphNode.widgets[0].type).toBe('text')
  })

  test('keeps missing source-node promotions as disconnected views', () => {
    const [subgraphNode] = setupSubgraph()
    setPromotions(subgraphNode, [['999', 'ghost']])
    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].type).toBe('button')
  })
})

function createFakeCanvasContext() {
  return new Proxy({} as CanvasRenderingContext2D, {
    get: () => vi.fn(() => ({ width: 10 }))
  })
}

function createInspectableCanvasContext(fillText = vi.fn()) {
  const fallback = vi.fn()
  return new Proxy(
    {
      fillText,
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 8 }),
      fillStyle: '#fff',
      strokeStyle: '#fff',
      textAlign: 'left',
      globalAlpha: 1,
      lineWidth: 1
    } as Record<string, unknown>,
    {
      get(target, key) {
        if (typeof key === 'string' && key in target)
          return target[key as keyof typeof target]
        return fallback
      }
    }
  ) as unknown as CanvasRenderingContext2D
}

function createTwoLevelNestedSubgraph() {
  const subgraphA = createTestSubgraph({
    inputs: [{ name: 'a_input', type: '*' }]
  })
  const innerNode = new LGraphNode('InnerComboNode')
  const innerInput = innerNode.addInput('picker_input', '*')
  const comboWidget = innerNode.addWidget('combo', 'picker', 'a', () => {}, {
    values: ['a', 'b']
  })
  innerInput.widget = { name: 'picker' }
  subgraphA.add(innerNode)
  subgraphA.inputNode.slots[0].connect(innerInput, innerNode)

  const subgraphNodeA = createTestSubgraphNode(subgraphA, { id: 11 })

  const subgraphB = createTestSubgraph({
    inputs: [{ name: 'b_input', type: '*' }]
  })
  subgraphB.add(subgraphNodeA)
  subgraphNodeA._internalConfigureAfterSlots()
  subgraphB.inputNode.slots[0].connect(subgraphNodeA.inputs[0], subgraphNodeA)

  const subgraphNodeB = createTestSubgraphNode(subgraphB, { id: 22 })
  return { innerNode, comboWidget, subgraphNodeB }
}

describe('promoted combo rendering', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  test('draw shows value even when interior combo is computedDisabled', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    const innerNode = firstInnerNode(innerNodes)
    const comboWidget = innerNode.addWidget('combo', 'picker', 'a', () => {}, {
      values: ['a', 'b']
    })

    // Simulates source widgets connected to subgraph inputs.
    comboWidget.computedDisabled = true
    setPromotions(subgraphNode, [[String(innerNode.id), 'picker']])

    const fillText = vi.fn()
    const ctx = createInspectableCanvasContext(fillText)
    subgraphNode.widgets[0].draw?.(
      ctx,
      subgraphNode,
      260,
      0,
      LiteGraph.NODE_WIDGET_HEIGHT,
      false
    )

    const renderedText = fillText.mock.calls.map((call) => call[0])
    expect(renderedText).toContain('a')
  })

  test('draw shows value through two input-based promotion layers', () => {
    const { comboWidget, subgraphNodeB } = createTwoLevelNestedSubgraph()
    comboWidget.computedDisabled = true
    const fillText = vi.fn()
    const ctx = createInspectableCanvasContext(fillText)

    subgraphNodeB.widgets[0].draw?.(
      ctx,
      subgraphNodeB,
      260,
      0,
      LiteGraph.NODE_WIDGET_HEIGHT,
      false
    )

    const renderedText = fillText.mock.calls.map((call) => call[0])
    expect(renderedText).toContain('a')
  })

  test('value updates propagate through two promoted input layers', () => {
    const { comboWidget, subgraphNodeB } = createTwoLevelNestedSubgraph()
    comboWidget.computedDisabled = true
    const promotedWidget = subgraphNodeB.widgets[0]

    expect(promotedWidget.value).toBe('a')
    promotedWidget.value = 'b'
    expect(comboWidget.value).toBe('b')

    const fillText = vi.fn()
    const ctx = createInspectableCanvasContext(fillText)
    promotedWidget.draw?.(
      ctx,
      subgraphNodeB,
      260,
      0,
      LiteGraph.NODE_WIDGET_HEIGHT,
      false
    )

    const renderedText = fillText.mock.calls.map((call) => call[0])
    expect(renderedText).toContain('b')
  })

  test('draw projection recovers after transient button fallback in nested promotion', () => {
    const { innerNode, subgraphNodeB } = createTwoLevelNestedSubgraph()
    const promotedWidget = subgraphNodeB.widgets[0]

    // Force a transient disconnect to project a fallback widget once.
    innerNode.widgets = []
    promotedWidget.draw?.(
      createInspectableCanvasContext(),
      subgraphNodeB,
      260,
      0,
      LiteGraph.NODE_WIDGET_HEIGHT,
      false
    )

    // Restore the concrete widget and verify draw reflects recovery.
    innerNode.addWidget('combo', 'picker', 'a', () => {}, {
      values: ['a', 'b']
    })
    const fillText = vi.fn()
    promotedWidget.draw?.(
      createInspectableCanvasContext(fillText),
      subgraphNodeB,
      260,
      0,
      LiteGraph.NODE_WIDGET_HEIGHT,
      false
    )

    const renderedText = fillText.mock.calls.map((call) => call[0])
    expect(renderedText).toContain('a')
  })

  test('state lookup behavior resolves to deepest promoted widget source', () => {
    const { comboWidget, subgraphNodeB } = createTwoLevelNestedSubgraph()

    const promotedWidget = subgraphNodeB.widgets[0]
    expect(promotedWidget.value).toBe('a')

    comboWidget.value = 'b'
    expect(promotedWidget.value).toBe('b')
  })

  test('state lookup does not use promotion store fallback when intermediate view is unavailable', () => {
    const subgraphA = createTestSubgraph({
      inputs: [{ name: 'strength_model', type: '*' }]
    })
    const innerNode = new LGraphNode('InnerNumberNode')
    const innerInput = innerNode.addInput('strength_model', '*')
    innerNode.addWidget('number', 'strength_model', 1, () => {})
    innerInput.widget = { name: 'strength_model' }
    subgraphA.add(innerNode)
    subgraphA.inputNode.slots[0].connect(innerInput, innerNode)

    const subgraphNodeA = createTestSubgraphNode(subgraphA, { id: 47 })

    const subgraphB = createTestSubgraph({
      inputs: [{ name: 'strength_model', type: '*' }]
    })
    subgraphB.add(subgraphNodeA)
    subgraphNodeA._internalConfigureAfterSlots()
    subgraphB.inputNode.slots[0].connect(subgraphNodeA.inputs[0], subgraphNodeA)

    const subgraphNodeB = createTestSubgraphNode(subgraphB, { id: 46 })

    // Simulate transient stale intermediate view state by forcing host 47
    // to report no promoted widgets while promotionStore still has entries.
    Object.defineProperty(subgraphNodeA, 'widgets', {
      get: () => [],
      configurable: true
    })

    expect(subgraphNodeB.widgets[0].type).toBe('button')
  })

  test('state lookup does not use input-widget fallback when intermediate promotions are absent', () => {
    const subgraphA = createTestSubgraph({
      inputs: [{ name: 'strength_model', type: '*' }]
    })
    const innerNode = new LGraphNode('InnerNumberNode')
    const innerInput = innerNode.addInput('strength_model', '*')
    innerNode.addWidget('number', 'strength_model', 1, () => {})
    innerInput.widget = { name: 'strength_model' }
    subgraphA.add(innerNode)
    subgraphA.inputNode.slots[0].connect(innerInput, innerNode)

    const subgraphNodeA = createTestSubgraphNode(subgraphA, { id: 47 })

    const subgraphB = createTestSubgraph({
      inputs: [{ name: 'strength_model', type: '*' }]
    })
    subgraphB.add(subgraphNodeA)
    subgraphNodeA._internalConfigureAfterSlots()
    subgraphB.inputNode.slots[0].connect(subgraphNodeA.inputs[0], subgraphNodeA)

    const subgraphNodeB = createTestSubgraphNode(subgraphB, { id: 46 })

    // Simulate a transient where intermediate promotions are unavailable but
    // input _widget binding is already updated.
    usePromotionStore().setPromotions(
      subgraphNodeA.rootGraph.id,
      subgraphNodeA.id,
      []
    )
    Object.defineProperty(subgraphNodeA, 'widgets', {
      get: () => [],
      configurable: true
    })

    expect(subgraphNodeB.widgets[0].type).toBe('button')
  })

  test('state lookup does not use subgraph-link fallback when intermediate bindings are unavailable', () => {
    const subgraphA = createTestSubgraph({
      inputs: [{ name: 'strength_model', type: '*' }]
    })
    const innerNode = new LGraphNode('InnerNumberNode')
    const innerInput = innerNode.addInput('strength_model', '*')
    innerNode.addWidget('number', 'strength_model', 1, () => {})
    innerInput.widget = { name: 'strength_model' }
    subgraphA.add(innerNode)
    subgraphA.inputNode.slots[0].connect(innerInput, innerNode)

    const subgraphNodeA = createTestSubgraphNode(subgraphA, { id: 47 })

    const subgraphB = createTestSubgraph({
      inputs: [{ name: 'strength_model', type: '*' }]
    })
    subgraphB.add(subgraphNodeA)
    subgraphNodeA._internalConfigureAfterSlots()
    subgraphB.inputNode.slots[0].connect(subgraphNodeA.inputs[0], subgraphNodeA)

    const subgraphNodeB = createTestSubgraphNode(subgraphB, { id: 46 })

    usePromotionStore().setPromotions(
      subgraphNodeA.rootGraph.id,
      subgraphNodeA.id,
      []
    )
    Object.defineProperty(subgraphNodeA, 'widgets', {
      get: () => [],
      configurable: true
    })
    subgraphNodeA.inputs[0]._widget = undefined

    expect(subgraphNodeB.widgets[0].type).toBe('button')
  })

  test('nested promotion keeps concrete widget types at top level', () => {
    const subgraphA = createTestSubgraph({
      inputs: [
        { name: 'lora_name', type: '*' },
        { name: 'strength_model', type: '*' }
      ]
    })
    const innerNode = new LGraphNode('InnerLoraNode')
    const comboInput = innerNode.addInput('lora_name', '*')
    const numberInput = innerNode.addInput('strength_model', '*')
    innerNode.addWidget('combo', 'lora_name', 'a', () => {}, {
      values: ['a', 'b']
    })
    innerNode.addWidget('number', 'strength_model', 1, () => {})
    comboInput.widget = { name: 'lora_name' }
    numberInput.widget = { name: 'strength_model' }
    subgraphA.add(innerNode)
    subgraphA.inputNode.slots[0].connect(comboInput, innerNode)
    subgraphA.inputNode.slots[1].connect(numberInput, innerNode)

    const subgraphNodeA = createTestSubgraphNode(subgraphA, { id: 60 })

    const subgraphB = createTestSubgraph({
      inputs: [
        { name: 'lora_name', type: '*' },
        { name: 'strength_model', type: '*' }
      ]
    })
    subgraphB.add(subgraphNodeA)
    subgraphNodeA._internalConfigureAfterSlots()
    subgraphB.inputNode.slots[0].connect(subgraphNodeA.inputs[0], subgraphNodeA)
    subgraphB.inputNode.slots[1].connect(subgraphNodeA.inputs[1], subgraphNodeA)

    const subgraphNodeB = createTestSubgraphNode(subgraphB, { id: 61 })

    expect(subgraphNodeB.widgets[0].type).toBe('combo')
    expect(subgraphNodeB.widgets[1].type).toBe('number')
  })

  test('input promotion from promoted view stores immediate source node id', () => {
    const subgraphA = createTestSubgraph({
      inputs: [{ name: 'lora_name', type: '*' }]
    })
    const innerNode = new LGraphNode('InnerNode')
    const innerInput = innerNode.addInput('lora_name', '*')
    innerNode.addWidget('combo', 'lora_name', 'a', () => {}, {
      values: ['a', 'b']
    })
    innerInput.widget = { name: 'lora_name' }
    subgraphA.add(innerNode)
    subgraphA.inputNode.slots[0].connect(innerInput, innerNode)

    const subgraphNodeA = createTestSubgraphNode(subgraphA, { id: 70 })

    const subgraphB = createTestSubgraph({
      inputs: [{ name: 'lora_name', type: '*' }]
    })
    subgraphB.add(subgraphNodeA)
    subgraphNodeA._internalConfigureAfterSlots()
    subgraphB.inputNode.slots[0].connect(subgraphNodeA.inputs[0], subgraphNodeA)

    const subgraphNodeB = createTestSubgraphNode(subgraphB, { id: 71 })
    const promotions = usePromotionStore().getPromotions(
      subgraphNodeB.rootGraph.id,
      subgraphNodeB.id
    )

    expect(promotions).toContainEqual({
      interiorNodeId: String(subgraphNodeA.id),
      widgetName: 'lora_name'
    })
    expect(promotions).not.toContainEqual({
      interiorNodeId: String(innerNode.id),
      widgetName: 'lora_name'
    })
  })

  test('resolvePromotedWidgetSource is safe for detached subgraph hosts', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph, { id: 101 })
    const promotedView = createPromotedWidgetView(
      subgraphNode,
      '999',
      'missingWidget'
    )

    subgraphNode.graph = null

    expect(() =>
      resolvePromotedWidgetSource(subgraphNode, promotedView)
    ).not.toThrow()
    expect(
      resolvePromotedWidgetSource(subgraphNode, promotedView)
    ).toBeUndefined()
  })
})

describe('DOM widget promotion', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  function createMockDOMWidget(node: LGraphNode, name: string) {
    const widget = node.addWidget('text', name, 'val', () => {})
    // Add 'element' and 'id' to make it a BaseDOMWidget
    Object.defineProperties(widget, {
      element: { value: document.createElement('div'), enumerable: true },
      id: { value: `dom-widget-${name}`, enumerable: true }
    })
    return widget
  }

  function createMockComponentWidget(node: LGraphNode, name: string) {
    const widget = node.addWidget('custom', name, 'val', () => {})
    Object.defineProperties(widget, {
      component: { value: {}, enumerable: true },
      id: { value: `comp-widget-${name}`, enumerable: true }
    })
    return widget
  }

  test('draw registers position override for DOM widgets', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    createMockDOMWidget(innerNodes[0], 'textarea')
    setPromotions(subgraphNode, [['1', 'textarea']])

    const view = subgraphNode.widgets[0]
    view.draw!(createFakeCanvasContext(), subgraphNode, 200, 0, 30)

    expect(mockDomWidgetStore.setPositionOverride).toHaveBeenCalledWith(
      'dom-widget-textarea',
      { node: subgraphNode, widget: view }
    )
  })

  test('draw registers position override for component widgets', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    createMockComponentWidget(innerNodes[0], 'compWidget')
    setPromotions(subgraphNode, [['1', 'compWidget']])

    const view = subgraphNode.widgets[0]
    view.draw!(createFakeCanvasContext(), subgraphNode, 200, 0, 30)

    expect(mockDomWidgetStore.setPositionOverride).toHaveBeenCalledWith(
      'comp-widget-compWidget',
      { node: subgraphNode, widget: view }
    )
  })

  test('draw does not register override for non-DOM widgets', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'textWidget', 'val', () => {})
    setPromotions(subgraphNode, [['1', 'textWidget']])

    const view = subgraphNode.widgets[0]
    view.draw!(createFakeCanvasContext(), subgraphNode, 200, 0, 30, true)

    expect(mockDomWidgetStore.setPositionOverride).not.toHaveBeenCalled()
  })

  test('draw does not mutate interior node pos or size for non-DOM widgets', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    const interiorNode = firstInnerNode(innerNodes)
    interiorNode.pos = [10, 20]
    interiorNode.size = [300, 120]
    interiorNode.addWidget('text', 'textWidget', 'val', () => {})
    setPromotions(subgraphNode, [[String(interiorNode.id), 'textWidget']])

    const originalPos = [...interiorNode.pos]
    const originalSize = [...interiorNode.size]
    const view = subgraphNode.widgets[0]

    view.draw!(createFakeCanvasContext(), subgraphNode, 200, 0, 30)

    expect(Array.from(interiorNode.pos)).toEqual(originalPos)
    expect(Array.from(interiorNode.size)).toEqual(originalSize)
  })

  test('computeLayoutSize delegates to interior DOM widget', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    const domWidget = createMockDOMWidget(innerNodes[0], 'textarea')
    domWidget.computeLayoutSize = vi.fn(() => ({
      minHeight: 100,
      maxHeight: 300,
      minWidth: 0
    }))
    setPromotions(subgraphNode, [['1', 'textarea']])

    const view = subgraphNode.widgets[0]
    const result = view.computeLayoutSize!(subgraphNode)

    expect(result).toEqual({ minHeight: 100, maxHeight: 300, minWidth: 0 })
  })

  test('demoting clears position override for DOM widget', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    createMockDOMWidget(innerNodes[0], 'textarea')
    setPromotions(subgraphNode, [['1', 'textarea']])

    const view = subgraphNode.widgets[0]
    subgraphNode.removeWidget(view)

    expect(mockDomWidgetStore.clearPositionOverride).toHaveBeenCalledWith(
      'dom-widget-textarea'
    )
  })

  test('onRemoved clears position overrides for all promoted DOM widgets', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    createMockDOMWidget(innerNodes[0], 'widgetA')
    createMockDOMWidget(innerNodes[0], 'widgetB')
    setPromotions(subgraphNode, [
      ['1', 'widgetA'],
      ['1', 'widgetB']
    ])

    // Access widgets to populate cache
    expect(subgraphNode.widgets).toHaveLength(2)

    subgraphNode.onRemoved()

    expect(mockDomWidgetStore.clearPositionOverride).toHaveBeenCalledWith(
      'dom-widget-widgetA'
    )
    expect(mockDomWidgetStore.clearPositionOverride).toHaveBeenCalledWith(
      'dom-widget-widgetB'
    )
  })
})
