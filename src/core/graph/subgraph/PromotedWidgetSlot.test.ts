import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PromotedWidgetSlot } from '@/core/graph/subgraph/PromotedWidgetSlot'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

vi.mock('@/lib/litegraph/src/widgets/widgetMap', () => ({
  toConcreteWidget: vi.fn(() => null)
}))

function createMockSubgraphNode(
  subgraphNodes: Record<string, LGraphNode> = {}
): SubgraphNode {
  const subgraph = {
    getNodeById: vi.fn((id: string) => subgraphNodes[id] ?? null)
  } as unknown as LGraph

  return {
    subgraph,
    isSubgraphNode: () => true,
    id: 99,
    type: 'graph/subgraph',
    graph: {} as LGraph,
    widgets: [],
    inputs: [],
    outputs: [],
    pos: [0, 0],
    size: [200, 100],
    properties: {}
  } as unknown as SubgraphNode
}

function createMockWidget(overrides: Partial<IBaseWidget> = {}): IBaseWidget {
  return {
    name: 'seed',
    type: 'number',
    value: 42,
    options: {},
    y: 0,
    ...overrides
  } as IBaseWidget
}

describe('PromotedWidgetSlot', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('sets name from sourceNodeId and sourceWidgetName', () => {
    const subNode = createMockSubgraphNode()
    const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
    expect(slot.name).toBe('5: seed')
    expect(slot.sourceNodeId).toBe('5')
    expect(slot.sourceWidgetName).toBe('seed')
  })

  it('is always promoted', () => {
    const subNode = createMockSubgraphNode()
    const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
    expect(slot.promoted).toBe(true)
  })

  it('has serialize set to false', () => {
    const subNode = createMockSubgraphNode()
    const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
    expect(slot.serialize).toBe(false)
  })

  describe('resolve', () => {
    it('resolves type from interior widget', () => {
      const interiorWidget = createMockWidget({ type: 'number' })
      const interiorNode = {
        id: '5',
        widgets: [interiorWidget]
      } as unknown as LGraphNode

      const subNode = createMockSubgraphNode({ '5': interiorNode })
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')

      expect(slot.type).toBe('number')
      expect(slot.resolvedType).toBe('number')
    })

    it('returns button type when interior node is missing', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')

      expect(slot.type).toBe('button')
      expect(slot.resolvedType).toBe('button')
    })

    it('returns button type when interior widget is missing', () => {
      const interiorNode = {
        id: '5',
        widgets: [createMockWidget({ name: 'other_widget' })]
      } as unknown as LGraphNode

      const subNode = createMockSubgraphNode({ '5': interiorNode })
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')

      expect(slot.type).toBe('button')
      expect(slot.resolvedType).toBe('button')
    })
  })

  describe('value', () => {
    it('reads value from WidgetValueStore', () => {
      const interiorWidget = createMockWidget()
      const interiorNode = {
        id: '5',
        widgets: [interiorWidget]
      } as unknown as LGraphNode

      const subNode = createMockSubgraphNode({ '5': interiorNode })
      const store = useWidgetValueStore()

      store.registerWidget({
        nodeId: '5',
        name: 'seed',
        type: 'number',
        value: 12345,
        options: {},
        disabled: false,
        promoted: true
      })

      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      expect(slot.value).toBe(12345)
    })

    it('returns undefined when widget state is not in store', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')

      expect(slot.value).toBeUndefined()
    })

    it('writes value to interior widget', () => {
      const interiorWidget = createMockWidget()
      const interiorNode = {
        id: '5',
        widgets: [interiorWidget]
      } as unknown as LGraphNode

      const subNode = createMockSubgraphNode({ '5': interiorNode })
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      slot.value = 99999

      expect(interiorWidget.value).toBe(99999)
    })
  })

  describe('label', () => {
    it('returns store label when available', () => {
      const store = useWidgetValueStore()
      store.registerWidget({
        nodeId: '5',
        name: 'seed',
        type: 'number',
        value: 42,
        options: {},
        label: 'Custom Label',
        disabled: false,
        promoted: true
      })

      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      expect(slot.label).toBe('Custom Label')
    })

    it('falls back to name when store has no label', () => {
      const store = useWidgetValueStore()
      store.registerWidget({
        nodeId: '5',
        name: 'seed',
        type: 'number',
        value: 42,
        options: {},
        disabled: false,
        promoted: true
      })

      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      expect(slot.label).toBe('5: seed')
    })

    it('writes label to interior widget', () => {
      const interiorWidget = createMockWidget()
      const interiorNode = {
        id: '5',
        widgets: [interiorWidget]
      } as unknown as LGraphNode

      const subNode = createMockSubgraphNode({ '5': interiorNode })
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      slot.label = 'Renamed'

      expect(interiorWidget.label).toBe('Renamed')
    })

    it('clears label on interior widget when set to undefined', () => {
      const interiorWidget = createMockWidget()
      interiorWidget.label = 'Old Label'
      const interiorNode = {
        id: '5',
        widgets: [interiorWidget]
      } as unknown as LGraphNode

      const subNode = createMockSubgraphNode({ '5': interiorNode })
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      slot.label = undefined

      expect(interiorWidget.label).toBeUndefined()
    })

    it('does not throw when setting label while disconnected', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')

      expect(() => {
        slot.label = 'Renamed'
      }).not.toThrow()
    })
  })

  describe('type and options accessors', () => {
    it('defines type as an accessor on the instance, not the prototype', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      const descriptor = Object.getOwnPropertyDescriptor(slot, 'type')
      expect(descriptor).toBeDefined()
      expect(descriptor!.get).toBeDefined()
    })

    it('defines options as an accessor on the instance, not the prototype', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      const descriptor = Object.getOwnPropertyDescriptor(slot, 'options')
      expect(descriptor).toBeDefined()
      expect(descriptor!.get).toBeDefined()
    })
  })

  describe('options', () => {
    it('delegates to interior widget options', () => {
      const interiorWidget = createMockWidget({
        options: { step: 10, min: 0, max: 100 }
      })
      const interiorNode = {
        id: '5',
        widgets: [interiorWidget]
      } as unknown as LGraphNode

      const subNode = createMockSubgraphNode({ '5': interiorNode })
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')

      expect(slot.options.step).toBe(10)
      expect(slot.options.min).toBe(0)
      expect(slot.options.max).toBe(100)
    })

    it('returns empty object when disconnected', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')

      expect(slot.options).toEqual({})
    })
  })

  describe('drawWidget', () => {
    function createMockCtx() {
      return {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 50 })),
        textAlign: '',
        textBaseline: '',
        fillStyle: '',
        strokeStyle: '',
        font: '',
        globalAlpha: 1
      } as unknown as CanvasRenderingContext2D
    }

    it('uses drawTruncatingText for disconnected placeholder', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      const spy = vi.spyOn(
        slot as unknown as { drawTruncatingText: (...args: unknown[]) => void },
        'drawTruncatingText'
      )

      const ctx = createMockCtx()
      slot.drawWidget(ctx, { width: 200, showText: true })

      expect(spy).toHaveBeenCalled()
    })

    it('restores concrete widget y/last_y even when drawWidget throws', () => {
      const interiorWidget = createMockWidget({ type: 'number' })
      const interiorNode = {
        id: '5',
        widgets: [interiorWidget]
      } as unknown as LGraphNode
      const subNode = createMockSubgraphNode({ '5': interiorNode })
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      slot.y = 100
      slot.last_y = 90

      const concreteWidget = {
        y: 10,
        last_y: 5,
        drawWidget: vi.fn(() => {
          throw new Error('render failure')
        })
      } as unknown as BaseWidget<IBaseWidget>

      vi.mocked(toConcreteWidget).mockReturnValueOnce(concreteWidget)

      const ctx = createMockCtx()
      expect(() =>
        slot.drawWidget(ctx, { width: 200, showText: true })
      ).toThrow('render failure')

      expect(concreteWidget.y).toBe(10)
      expect(concreteWidget.last_y).toBe(5)
    })
  })

  describe('onClick', () => {
    it('does not throw when disconnected', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')

      expect(() =>
        slot.onClick({
          e: {} as never,
          node: subNode,
          canvas: {} as never
        })
      ).not.toThrow()
    })
  })

  describe('callback', () => {
    it('delegates to interior widget callback', () => {
      const interiorCallback = vi.fn()
      const interiorWidget = createMockWidget({ callback: interiorCallback })
      const interiorNode = {
        id: '5',
        widgets: [interiorWidget]
      } as unknown as LGraphNode

      const subNode = createMockSubgraphNode({ '5': interiorNode })
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      slot.callback?.(42)

      expect(interiorCallback).toHaveBeenCalledWith(
        42,
        undefined,
        interiorNode,
        undefined,
        undefined
      )
    })

    it('does not throw when disconnected', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')

      expect(() => slot.callback?.(42)).not.toThrow()
    })

    it('can be reassigned as a property', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      const customCallback = vi.fn()

      slot.callback = customCallback
      slot.callback?.(99)

      expect(customCallback).toHaveBeenCalledWith(99)
    })
  })

  describe('_displayValue', () => {
    it('returns string representation of value', () => {
      const store = useWidgetValueStore()
      store.registerWidget({
        nodeId: '5',
        name: 'seed',
        type: 'number',
        value: 42,
        options: {},
        disabled: false,
        promoted: true
      })

      const interiorNode = {
        id: '5',
        widgets: [createMockWidget()]
      } as unknown as LGraphNode
      const subNode = createMockSubgraphNode({ '5': interiorNode })
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      expect(slot._displayValue).toBe('42')
    })

    it('returns Disconnected when interior node is missing', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      expect(slot._displayValue).toBe('Disconnected')
    })

    it('returns empty string when computedDisabled', () => {
      const store = useWidgetValueStore()
      store.registerWidget({
        nodeId: '5',
        name: 'seed',
        type: 'number',
        value: 42,
        options: {},
        disabled: false,
        promoted: true
      })

      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      slot.computedDisabled = true
      expect(slot._displayValue).toBe('')
    })
  })
})
