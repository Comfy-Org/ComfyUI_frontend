import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    querySlotAtPoint: vi.fn(),
    queryRerouteAtPoint: vi.fn(),
    getNodeLayoutRef: vi.fn(() => ({ value: null })),
    getSlotLayout: vi.fn(),
    setSource: vi.fn(),
    batchUpdateNodeBounds: vi.fn()
  }
}))

function createCanvas(graph: LGraph): LGraphCanvas {
  const el = document.createElement('canvas')
  el.width = 800
  el.height = 600

  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    roundRect: vi.fn(),
    getTransform: vi
      .fn()
      .mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline
  } as Partial<CanvasRenderingContext2D> as CanvasRenderingContext2D

  el.getContext = vi.fn().mockReturnValue(ctx)
  el.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 600
  })

  return new LGraphCanvas(el, graph, { skip_render: true })
}

class TestNode extends LGraphNode {
  constructor() {
    super('test')
  }
}

describe('LGraphCanvas group selection', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let group: LGraphGroup
  let nodeA: TestNode
  let nodeB: TestNode

  beforeAll(() => {
    LiteGraph.registerNodeType('test', TestNode)
  })

  beforeEach(() => {
    vi.clearAllMocks()

    graph = new LGraph()
    canvas = createCanvas(graph)

    group = new LGraphGroup('TestGroup')
    group._bounding.set([0, 0, 500, 500])
    graph.add(group)

    nodeA = new TestNode()
    nodeA.pos = [50, 50]
    graph.add(nodeA)

    nodeB = new TestNode()
    nodeB.pos = [100, 100]
    graph.add(nodeB)

    group.recomputeInsideNodes()
  })

  describe('select with groupSelectChildren enabled', () => {
    beforeEach(() => {
      canvas.groupSelectChildren = true
    })

    it('selects all children when selecting a group', () => {
      canvas.select(group)

      expect(group.selected).toBe(true)
      expect(nodeA.selected).toBe(true)
      expect(nodeB.selected).toBe(true)
      expect(canvas.selectedItems.has(group)).toBe(true)
      expect(canvas.selectedItems.has(nodeA)).toBe(true)
      expect(canvas.selectedItems.has(nodeB)).toBe(true)
    })

    it('recursively selects nested group children', () => {
      const innerGroup = new LGraphGroup('InnerGroup')
      innerGroup._bounding.set([40, 40, 200, 200])
      graph.add(innerGroup)

      const innerNode = new TestNode()
      innerNode.pos = [60, 60]
      graph.add(innerNode)

      innerGroup.recomputeInsideNodes()
      group.recomputeInsideNodes()

      canvas.select(group)

      expect(innerGroup.selected).toBe(true)
      expect(innerNode.selected).toBe(true)
      expect(canvas.selectedItems.has(innerGroup)).toBe(true)
      expect(canvas.selectedItems.has(innerNode)).toBe(true)
    })
  })

  describe('select with groupSelectChildren disabled', () => {
    beforeEach(() => {
      canvas.groupSelectChildren = false
    })

    it('does not select children when selecting a group', () => {
      canvas.select(group)

      expect(group.selected).toBe(true)
      expect(nodeA.selected).toBeFalsy()
      expect(nodeB.selected).toBeFalsy()
      expect(canvas.selectedItems.has(group)).toBe(true)
      expect(canvas.selectedItems.has(nodeA)).toBe(false)
    })
  })

  describe('deselect with groupSelectChildren enabled', () => {
    beforeEach(() => {
      canvas.groupSelectChildren = true
    })

    it('deselects all children when deselecting a group', () => {
      canvas.select(group)
      expect(nodeA.selected).toBe(true)

      canvas.deselect(group)

      expect(group.selected).toBe(false)
      expect(nodeA.selected).toBe(false)
      expect(nodeB.selected).toBe(false)
      expect(canvas.selectedItems.has(group)).toBe(false)
      expect(canvas.selectedItems.has(nodeA)).toBe(false)
    })

    it('recursively deselects nested group children', () => {
      const innerGroup = new LGraphGroup('InnerGroup')
      innerGroup._bounding.set([40, 40, 200, 200])
      graph.add(innerGroup)

      const innerNode = new TestNode()
      innerNode.pos = [60, 60]
      graph.add(innerNode)

      innerGroup.recomputeInsideNodes()
      group.recomputeInsideNodes()

      canvas.select(group)
      expect(innerNode.selected).toBe(true)

      canvas.deselect(group)

      expect(innerGroup.selected).toBe(false)
      expect(innerNode.selected).toBe(false)
    })
  })

  describe('deselect with groupSelectChildren disabled', () => {
    it('does not deselect children when deselecting a group', () => {
      canvas.groupSelectChildren = true
      canvas.select(group)

      canvas.groupSelectChildren = false
      canvas.deselect(group)

      expect(group.selected).toBe(false)
      expect(nodeA.selected).toBe(true)
      expect(nodeB.selected).toBe(true)
    })
  })
})
