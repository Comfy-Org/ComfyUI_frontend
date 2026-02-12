import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PromotedWidgetSlot } from '@/core/graph/subgraph/PromotedWidgetSlot'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

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
    it('draws disconnected placeholder when node is missing', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')

      const ctx = {
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

      slot.drawWidget(ctx, { width: 200, showText: true })

      expect(ctx.fillText).toHaveBeenCalledWith(
        'Disconnected',
        expect.any(Number),
        expect.any(Number)
      )
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

      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      expect(slot._displayValue).toBe('42')
    })

    it('returns empty string when value is null', () => {
      const subNode = createMockSubgraphNode()
      const slot = new PromotedWidgetSlot(subNode, '5', 'seed')
      expect(slot._displayValue).toBe('')
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
