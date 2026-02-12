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
  const listeners = new Map<string, EventListener[]>()
  const canvasElement = {
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type)!.push(handler)
    })
  }
  return {
    canvas: canvasElement,
    setDirty: vi.fn(),
    _listeners: listeners
  } as unknown as LGraphCanvas
}

function createMockSubgraphNode(
  widgets: IBaseWidget[] = []
): SubgraphNode & { properties: Record<string, unknown> } {
  return {
    isSubgraphNode: () => true,
    widgets,
    properties: { proxyWidgets: [] },
    _setConcreteSlots: vi.fn(),
    arrange: vi.fn()
  } as unknown as SubgraphNode & { properties: Record<string, unknown> }
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
      } as unknown as IBaseWidget
      const node = createMockSubgraphNode([nativeWidget])

      const serialisedNode = {
        properties: {}
      } as ISerialisedNode

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
      } as unknown as IBaseWidget

      const node = createMockSubgraphNode([nativeWidget])
      const serialisedNode = {
        properties: {}
      } as ISerialisedNode

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
      } as unknown as IBaseWidget

      const node = createMockSubgraphNode([nativeWidget])
      const serialisedNode = {
        properties: {}
      } as ISerialisedNode

      SubgraphNode.prototype.onConfigure!.call(node, serialisedNode)

      // Use -1 to reference native widgets
      node.properties.proxyWidgets = [['-1', 'steps']]

      // Native widget should be placed via the proxy list ordering
      expect(node.widgets).toHaveLength(1)
      expect(node.widgets[0].name).toBe('steps')
      expect(node.widgets[0]).toBe(nativeWidget)
    })
  })
})
