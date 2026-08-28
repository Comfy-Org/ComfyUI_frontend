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

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { TitleMode } from '@/lib/litegraph/src/types/globalEnums'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'

import {
  calculateInputSlotPosFromSlot,
  getSlotLayout,
  getSlotLayoutAtPoint,
  getSlotPosition
} from './slotCalculations'
import type { SlotPositionContext } from './slotCalculations'

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
    titleMode: TitleMode
    type: string
    id: number
    position: [number, number]
    size: [number, number]
  }> = {}
): LGraphNode {
  const position = overrides.position ?? [100, 200]
  const size = overrides.size ?? [180, 120]
  return fromPartial<LGraphNode>({
    id: toNodeId(overrides.id ?? 1),
    pos: position,
    size,
    renderingSize: size,
    flags: { collapsed: overrides.collapsed ?? false },
    title_mode: overrides.titleMode ?? TitleMode.NORMAL_TITLE,
    type: overrides.type ?? 'TestNode',
    _collapsed_width: mockLiteGraph.NODE_COLLAPSED_WIDTH,
    constructor: { slot_start_y: undefined },
    inputs: overrides.inputs ?? [],
    outputs: overrides.outputs ?? [],
    widgets: [],
    graph: { rootGraph: { id: 'root-graph' } }
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

    it('uses the legacy fallback position for a widget input itself', () => {
      const widget = makeInput({ name: 'widget', widget: { name: 'widget' } })
      const ctx = makeContext({
        inputs: [makeInput(), widget],
        widgets: [{ name: 'widget' }]
      })

      const [, y] = calculateInputSlotPosFromSlot(ctx, widget)

      expect(y).toBeCloseTo(200 - 0.3 * SLOT_HEIGHT)
    })

    it('uses the legacy fallback position for a detached input', () => {
      const detached = makeInput()
      const ctx = makeContext({ inputs: [makeInput(), makeInput()] })

      const [, y] = calculateInputSlotPosFromSlot(ctx, detached)

      expect(y).toBeCloseTo(200 - 0.3 * SLOT_HEIGHT)
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

describe('Vue slot geometry', () => {
  beforeEach(() => {
    mockLiteGraph.vueNodesMode = true
    layoutStore.resetForTests()
  })

  it('combines measured render offsets with the current node position', () => {
    const node = makeNode({
      inputs: [makeInput()],
      position: [300, 400]
    })
    if (!node.graph) throw new Error('Expected node graph')
    layoutStore.updateNodeSlotOffsets(
      node.graph.rootGraph.id,
      node.id,
      [{ index: 0, type: 'input', position: { x: 0, y: 73 } }],
      'expanded'
    )

    expect(getSlotPosition(node, 0, true)).toEqual([300, 473])
    const graph = fromPartial<LGraph>({
      _nodes: [node],
      rootGraph: { id: 'root-graph' }
    })
    expect(getSlotLayoutAtPoint(graph, { x: 300, y: 473 }, node)).toEqual(
      getSlotLayout(node, 0, true)
    )

    node.pos[0] = 450
    node.pos[1] = 500
    expect(getSlotPosition(node, 0, true)).toEqual([450, 573])
  })

  it('derives slot positions from the current node layout', () => {
    const node = makeNode({
      inputs: [makeInput()],
      outputs: [makeOutput()],
      position: [300, 400],
      size: [240, 160]
    })

    expect(getSlotPosition(node, 0, true)).toEqual([300, 414])
    expect(getSlotPosition(node, 0, false)).toEqual([540, 414])

    node.pos[0] = 320
    node.pos[1] = 450
    node.size[0] = 300

    expect(getSlotPosition(node, 0, true)).toEqual([320, 464])
    expect(getSlotPosition(node, 0, false)).toEqual([620, 464])
  })

  it('finds a measured slot immediately outside node bounds', () => {
    const node = makeNode({ inputs: [makeInput()], position: [300, 400] })
    if (!node.graph) throw new Error('Expected node graph')
    layoutStore.updateNodeSlotOffsets(
      node.graph.rootGraph.id,
      node.id,
      [{ index: 0, type: 'input', position: { x: -6, y: 14 } }],
      'expanded'
    )
    const graph = fromPartial<LGraph>({
      _nodes: [node],
      rootGraph: { id: 'root-graph' }
    })

    expect(getSlotLayoutAtPoint(graph, { x: 284, y: 414 })).toEqual(
      getSlotLayout(node, 0, true)
    )
  })

  it('finds protruding slots without relying on nearby node bounds', () => {
    const node = makeNode({ inputs: [makeInput()], position: [300, 400] })
    if (!node.graph) throw new Error('Expected node graph')
    layoutStore.updateNodeSlotOffsets(
      node.graph.rootGraph.id,
      node.id,
      [{ index: 0, type: 'input', position: { x: -6, y: 14 } }],
      'expanded'
    )
    const overlappingNode = makeNode({ position: [280, 390] })
    const graph = fromPartial<LGraph>({
      _nodes: [node, overlappingNode],
      rootGraph: { id: 'root-graph' }
    })

    expect(getSlotLayoutAtPoint(graph, { x: 284, y: 414 })).toEqual(
      getSlotLayout(node, 0, true)
    )
  })

  it('prefers the top rendered slot when nodes overlap', () => {
    const topNode = makeNode({ id: 1, inputs: [makeInput()] })
    const laterNode = makeNode({ id: 2, inputs: [makeInput()] })
    const graph = fromPartial<LGraph>({
      _nodes: [topNode, laterNode],
      rootGraph: { id: 'root-graph' }
    })
    for (const [node, zIndex] of [
      [topNode, 2],
      [laterNode, 1]
    ] as const) {
      layoutStore.applyOperation({
        type: 'createNode',
        graphId: 'root-graph',
        nodeId: node.id,
        layout: {
          id: node.id,
          position: { x: 100, y: 200 },
          size: { width: 180, height: 120 },
          zIndex,
          visible: true,
          bounds: { x: 100, y: 200, width: 180, height: 120 }
        },
        timestamp: 0,
        source: LayoutSource.Canvas
      })
    }

    expect(getSlotLayoutAtPoint(graph, { x: 100, y: 214 })?.nodeId).toBe(
      topNode.id
    )
  })

  it('uses widget slot visual positions for connected and unconnected inputs', () => {
    const widgetInput = makeInput({
      widget: { name: 'widget' },
      pos: [10, 88]
    })
    const node = makeNode({
      inputs: [widgetInput],
      position: [300, 400],
      size: [240, 160]
    })
    const graph = fromPartial<LGraph>({ nodes: [node] })

    expect(getSlotPosition(node, 0, true)).toEqual([300, 488])
    expect(getSlotLayoutAtPoint(graph, { x: 300, y: 488 }, node)).toEqual(
      getSlotLayout(node, 0, true)
    )
  })

  it('uses collapsed node anchors', () => {
    const node = makeNode({
      inputs: [makeInput()],
      outputs: [makeOutput()],
      collapsed: true,
      position: [300, 400]
    })

    expect(getSlotPosition(node, 0, true)).toEqual([300, 385])
    expect(getSlotPosition(node, 0, false)).toEqual([380, 385])
  })

  it('ignores expanded slot offsets after the node collapses', () => {
    const node = makeNode({
      inputs: [makeInput()],
      outputs: [makeOutput()],
      collapsed: true,
      position: [300, 400]
    })
    if (!node.graph) throw new Error('Expected node graph')
    layoutStore.updateNodeSlotOffsets(
      node.graph.rootGraph.id,
      node.id,
      [
        { index: 0, type: 'input', position: { x: 0, y: 73 } },
        { index: 0, type: 'output', position: { x: 180, y: 73 } }
      ],
      'expanded'
    )

    expect(getSlotPosition(node, 0, true)).toEqual([300, 385])
    expect(getSlotPosition(node, 0, false)).toEqual([380, 385])
  })

  it('uses collapsed slot offsets from the rendered node width', () => {
    const node = makeNode({
      inputs: [makeInput()],
      outputs: [makeOutput()],
      collapsed: true,
      position: [300, 400]
    })
    if (!node.graph) throw new Error('Expected node graph')
    layoutStore.updateNodeSlotOffsets(
      node.graph.rootGraph.id,
      node.id,
      [
        { index: 0, type: 'input', position: { x: 0, y: -15 } },
        { index: 0, type: 'output', position: { x: 280, y: -15 } }
      ],
      'collapsed'
    )

    expect(getSlotPosition(node, 0, true)).toEqual([300, 385])
    expect(getSlotPosition(node, 0, false)).toEqual([580, 385])
  })

  it('accounts for headerless and reroute node structure', () => {
    const headerless = makeNode({
      inputs: [makeInput()],
      titleMode: TitleMode.NO_TITLE,
      position: [300, 400],
      size: [240, 160]
    })
    const reroute = makeNode({
      outputs: [makeOutput()],
      titleMode: TitleMode.NO_TITLE,
      type: 'Reroute',
      position: [300, 400],
      size: [240, 160]
    })

    expect(getSlotPosition(headerless, 0, true)).toEqual([300, 384])
    expect(getSlotPosition(reroute, 0, false)).toEqual([540, 380])
  })
})
