import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockLiteGraph = vi.hoisted(() => ({
  NODE_TITLE_HEIGHT: 30,
  NODE_SLOT_HEIGHT: 20,
  NODE_COLLAPSED_WIDTH: 80,
  vueNodesMode: false
}))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LiteGraph: mockLiteGraph
}))

vi.mock('@/renderer/core/layout/slots/slotIdentifier', () => ({
  getSlotKey: vi.fn()
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getSlotLayout: vi.fn().mockReturnValue(null),
    getNodeLayoutRef: vi.fn().mockReturnValue({ value: null })
  }
}))

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'

import { calculateInputSlotPosFromSlot, getSlotPosition } from './slotCalculations';
import type { SlotPositionContext } from './slotCalculations';

const SLOT_HEIGHT = mockLiteGraph.NODE_SLOT_HEIGHT
const TITLE_HEIGHT = mockLiteGraph.NODE_TITLE_HEIGHT

function makeContext(
  overrides: Partial<SlotPositionContext> = {}
): SlotPositionContext {
  return {
    nodeX: 100,
    nodeY: 200,
    nodeWidth: 180,
    nodeHeight: 120,
    collapsed: false,
    inputs: [],
    outputs: [],
    ...overrides
  }
}

function makeInput(overrides: Partial<INodeInputSlot> = {}): INodeInputSlot {
  return { name: 'input', type: 'INT', ...overrides } as INodeInputSlot
}

function makeOutput(overrides: Partial<INodeOutputSlot> = {}): INodeOutputSlot {
  return { name: 'output', type: 'INT', ...overrides } as INodeOutputSlot
}

function makeNode(
  overrides: Partial<{
    inputs: INodeInputSlot[]
    outputs: INodeOutputSlot[]
    collapsed: boolean
  }> = {}
): LGraphNode {
  return fromPartial<LGraphNode>({
    id: 1,
    pos: [100, 200],
    size: [180, 120],
    flags: { collapsed: overrides.collapsed ?? false },
    _collapsed_width: mockLiteGraph.NODE_COLLAPSED_WIDTH,
    constructor: { slot_start_y: undefined },
    inputs: overrides.inputs ?? [],
    outputs: overrides.outputs ?? [],
    widgets: []
  })
}

describe('calculateInputSlotPosFromSlot', () => {
  describe('collapsed node', () => {
    it('returns node origin offset upward by half title height', () => {
      const input = makeInput()
      const ctx = makeContext({ collapsed: true })
      const [x, y] = calculateInputSlotPosFromSlot(ctx, input)
      expect(x).toBe(100)
      expect(y).toBe(200 - TITLE_HEIGHT * 0.5)
    })
  })

  describe('hard-coded slot position', () => {
    it('returns node origin plus the hard-coded offset', () => {
      const input = makeInput({ pos: [10, 25] })
      const ctx = makeContext()
      const [x, y] = calculateInputSlotPosFromSlot(ctx, input)
      expect(x).toBe(110)
      expect(y).toBe(225)
    })
  })

  describe('default vertical layout', () => {
    it('places the first input slot at the correct x and y', () => {
      const input = makeInput()
      const ctx = makeContext({ inputs: [input] })
      const [x, y] = calculateInputSlotPosFromSlot(ctx, input)
      expect(x).toBe(100 + SLOT_HEIGHT * 0.5)
      expect(y).toBeCloseTo(200 + 0.7 * SLOT_HEIGHT)
    })

    it('places subsequent slots below the first', () => {
      const first = makeInput({ name: 'a' })
      const second = makeInput({ name: 'b' })
      const ctx = makeContext({ inputs: [first, second] })
      const [, y1] = calculateInputSlotPosFromSlot(ctx, first)
      const [, y2] = calculateInputSlotPosFromSlot(ctx, second)
      expect(y2).toBeCloseTo(y1 + SLOT_HEIGHT)
    })

    it('respects slotStartY offset', () => {
      const input = makeInput()
      const base = makeContext({ inputs: [input] })
      const withOffset = makeContext({ inputs: [input], slotStartY: 40 })
      const [, yBase] = calculateInputSlotPosFromSlot(base, input)
      const [, yOffset] = calculateInputSlotPosFromSlot(withOffset, input)
      expect(yOffset).toBeCloseTo(yBase + 40)
    })

    it('excludes widget input slots from vertical ordering', () => {
      const widget = makeInput({ name: 'widget', widget: { name: 'widget' } })
      const regular = makeInput({ name: 'regular' })
      const ctx = makeContext({
        inputs: [widget, regular],
        widgets: [{ name: 'widget' }]
      })
      const [, yRegular] = calculateInputSlotPosFromSlot(ctx, regular)
      expect(yRegular).toBeCloseTo(200 + 0.7 * SLOT_HEIGHT)
    })

    it('excludes slots with hard-coded positions from vertical ordering', () => {
      const fixed = makeInput({ name: 'fixed', pos: [0, 50] })
      const regular = makeInput({ name: 'regular' })
      const ctx = makeContext({ inputs: [fixed, regular] })
      const [, y] = calculateInputSlotPosFromSlot(ctx, regular)
      expect(y).toBeCloseTo(200 + 0.7 * SLOT_HEIGHT)
    })
  })
})

describe('getSlotPosition — legacy fallback (vueNodesMode disabled)', () => {
  beforeEach(() => {
    mockLiteGraph.vueNodesMode = false
  })

  it('calculates input slot position from node.pos', () => {
    const input = makeInput()
    const node = makeNode({ inputs: [input] })
    const [x, y] = getSlotPosition(node, 0, true)
    expect(x).toBe(100 + SLOT_HEIGHT * 0.5)
    expect(y).toBeCloseTo(200 + 0.7 * SLOT_HEIGHT)
  })

  it('calculates output slot position from node.pos', () => {
    const output = makeOutput()
    const node = makeNode({ outputs: [output] })
    const [x, y] = getSlotPosition(node, 0, false)
    expect(x).toBeCloseTo(100 + 180 + 1 - SLOT_HEIGHT * 0.5)
    expect(y).toBeCloseTo(200 + 0.7 * SLOT_HEIGHT)
  })

  it('returns node origin offset upward when node is collapsed and requesting input', () => {
    const input = makeInput()
    const node = makeNode({ inputs: [input], collapsed: true })
    const [x, y] = getSlotPosition(node, 0, true)
    expect(x).toBe(100)
    expect(y).toBe(200 - TITLE_HEIGHT * 0.5)
  })

  it('returns node origin offset right when node is collapsed and requesting output', () => {
    const output = makeOutput()
    const node = makeNode({ outputs: [output], collapsed: true })
    const [x, y] = getSlotPosition(node, 0, false)
    expect(x).toBe(100 + mockLiteGraph.NODE_COLLAPSED_WIDTH)
    expect(y).toBe(200 - TITLE_HEIGHT * 0.5)
  })

  it('returns node origin for out-of-range input slot index', () => {
    const node = makeNode()
    const [x, y] = getSlotPosition(node, 5, true)
    expect(x).toBe(100)
    expect(y).toBe(200)
  })
})
