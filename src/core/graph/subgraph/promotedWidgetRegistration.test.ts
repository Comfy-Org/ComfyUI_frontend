import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PromotedWidgetSlot } from '@/core/graph/subgraph/PromotedWidgetSlot'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { registerPromotedWidgetSlots } from './promotedWidgetRegistration'

vi.mock('@/core/graph/subgraph/proxyWidgetUtils', () => ({
  promoteRecommendedWidgets: vi.fn()
}))

function createMockCanvas() {
  return {
    canvas: { addEventListener: vi.fn() },
    setDirty: vi.fn()
  } as unknown as LGraphCanvas
}

function createMockSubgraphNode(widgets: IBaseWidget[] = []): SubgraphNode {
  const base = {
    widgets,
    inputs: [],
    properties: { proxyWidgets: [] },
    _setConcreteSlots: vi.fn(),
    arrange: vi.fn()
  } satisfies Partial<Omit<SubgraphNode, 'constructor' | 'isSubgraphNode'>>

  return {
    ...base,
    isSubgraphNode: () => true
  } as unknown as SubgraphNode
}

describe('registerPromotedWidgetSlots', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('onConfigure – syncPromotedWidgets', () => {
    it('assigning to properties.proxyWidgets triggers widget reconstruction', () => {
      const canvas = createMockCanvas()
      registerPromotedWidgetSlots(canvas)

      const nativeWidget = {
        name: 'steps',
        type: 'number',
        value: 20,
        options: {},
        y: 0
      } satisfies Partial<IBaseWidget> as unknown as IBaseWidget
      const node = createMockSubgraphNode([nativeWidget])

      const serialisedNode = {
        properties: {}
      } satisfies Partial<ISerialisedNode> as unknown as ISerialisedNode

      SubgraphNode.prototype.onConfigure!.call(node, serialisedNode)

      // After onConfigure, proxyWidgets is a getter/setter property
      const descriptor = Object.getOwnPropertyDescriptor(
        node.properties,
        'proxyWidgets'
      )
      expect(descriptor?.set).toBeDefined()
      expect(descriptor?.get).toBeDefined()

      // Assign promoted widgets via the setter
      node.properties.proxyWidgets = [['42', 'seed']]

      // The setter should have created a PromotedWidgetSlot
      const promotedSlots = node.widgets.filter(
        (w) => w instanceof PromotedWidgetSlot
      )
      expect(promotedSlots).toHaveLength(1)
      expect(promotedSlots[0].sourceNodeId).toBe('42')
      expect(promotedSlots[0].sourceWidgetName).toBe('seed')

      // The setter should have called _setConcreteSlots and arrange
      expect(node._setConcreteSlots).toHaveBeenCalled()
      expect(node.arrange).toHaveBeenCalled()
    })

    it('preserves native widgets not in the proxy list', () => {
      const canvas = createMockCanvas()
      registerPromotedWidgetSlots(canvas)

      const nativeWidget = {
        name: 'steps',
        type: 'number',
        value: 20,
        options: {},
        y: 0
      } satisfies Partial<IBaseWidget> as unknown as IBaseWidget

      const node = createMockSubgraphNode([nativeWidget])
      const serialisedNode = {
        properties: {}
      } satisfies Partial<ISerialisedNode> as unknown as ISerialisedNode

      SubgraphNode.prototype.onConfigure!.call(node, serialisedNode)

      // Promote a different widget; native 'steps' should remain
      node.properties.proxyWidgets = [['42', 'seed']]

      const nativeWidgets = node.widgets.filter(
        (w) => !(w instanceof PromotedWidgetSlot)
      )
      expect(nativeWidgets).toHaveLength(1)
      expect(nativeWidgets[0].name).toBe('steps')
    })

    it('re-orders native widgets listed in the proxy list with id -1', () => {
      const canvas = createMockCanvas()
      registerPromotedWidgetSlots(canvas)

      const nativeWidget = {
        name: 'steps',
        type: 'number',
        value: 20,
        options: {},
        y: 0
      } satisfies Partial<IBaseWidget> as unknown as IBaseWidget

      const node = createMockSubgraphNode([nativeWidget])
      const serialisedNode = {
        properties: {}
      } satisfies Partial<ISerialisedNode> as unknown as ISerialisedNode

      SubgraphNode.prototype.onConfigure!.call(node, serialisedNode)

      // Use -1 to reference native widgets
      node.properties.proxyWidgets = [['-1', 'steps']]

      // Native widget should be placed via the proxy list ordering
      expect(node.widgets).toHaveLength(1)
      expect(node.widgets[0].name).toBe('steps')
      expect(node.widgets[0]).toBe(nativeWidget)
    })

    it('reuses existing PromotedWidgetSlot instances on re-sync', () => {
      const canvas = createMockCanvas()
      registerPromotedWidgetSlots(canvas)

      const node = createMockSubgraphNode()
      const serialisedNode = {
        properties: {}
      } satisfies Partial<ISerialisedNode> as unknown as ISerialisedNode

      SubgraphNode.prototype.onConfigure!.call(node, serialisedNode)

      // First sync: create a slot
      node.properties.proxyWidgets = [['42', 'seed']]
      const firstSlot = node.widgets.find(
        (w) => w instanceof PromotedWidgetSlot
      )
      expect(firstSlot).toBeDefined()

      // Second sync with same entry: should reuse the same instance
      node.properties.proxyWidgets = [['42', 'seed']]
      const secondSlot = node.widgets.find(
        (w) => w instanceof PromotedWidgetSlot
      )
      expect(secondSlot).toBe(firstSlot)
    })

    it('disposes only removed slots during reconciliation', () => {
      const canvas = createMockCanvas()
      registerPromotedWidgetSlots(canvas)

      const node = createMockSubgraphNode()
      const serialisedNode = {
        properties: {}
      } satisfies Partial<ISerialisedNode> as unknown as ISerialisedNode

      SubgraphNode.prototype.onConfigure!.call(node, serialisedNode)

      // Create two slots
      node.properties.proxyWidgets = [
        ['42', 'seed'],
        ['43', 'steps']
      ]
      const slots = node.widgets.filter(
        (w) => w instanceof PromotedWidgetSlot
      ) as PromotedWidgetSlot[]
      expect(slots).toHaveLength(2)

      const disposeSpy0 = vi.spyOn(slots[0], 'disposeDomAdapter')
      const disposeSpy1 = vi.spyOn(slots[1], 'disposeDomAdapter')

      // Remove only the second slot
      node.properties.proxyWidgets = [['42', 'seed']]

      // First slot should NOT have been disposed (reused)
      expect(disposeSpy0).not.toHaveBeenCalled()
      // Second slot should have been disposed (removed)
      expect(disposeSpy1).toHaveBeenCalled()

      // Only one promoted slot remains
      const remaining = node.widgets.filter(
        (w) => w instanceof PromotedWidgetSlot
      )
      expect(remaining).toHaveLength(1)
      expect(remaining[0]).toBe(slots[0])
    })
  })
})
