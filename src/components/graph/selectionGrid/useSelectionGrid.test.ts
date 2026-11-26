import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import type { LGraphCanvas } from '@comfyorg/litegraph/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@comfyorg/litegraph/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { bindMountedNodeSize } from '@comfyorg/graph-state/layout/mountedNodeSizes'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'
import { createTestLink } from '@comfyorg/litegraph/__fixtures__/litegraphTestUtils'

const nodeIn = (graph: LGraph, title: string) => {
  const node = new LGraphNode(title)
  graph.add(node)
  return node
}

describe('useSelectionGrid', () => {
  it.for([
    { start: 90, gap: 12 },
    { start: 100, gap: 0 },
    { start: 112.4, gap: 12.4 },
    { start: 300, gap: 48 }
  ])(
    'chooses a $gap default gap for nodes starting $start apart',
    ({ start, gap }) => {
      const graph = new LGraph()
      const a = nodeIn(graph, 'A')
      const b = nodeIn(graph, 'B')
      a.pos = [0, 0]
      b.pos = [start, 0]
      a.size = [100, 100]
      b.size = [100, 100]
      const canvasStore = useCanvasStore()
      canvasStore.canvas = fromPartial<LGraphCanvas>({
        graph,
        setDirty: vi.fn()
      })
      canvasStore.currentGraph = graph

      expect(
        useSelectionGrid().tidyUp([a, b], { captureUndo: false })
      ).toBeCloseTo(gap)
      expect(b.pos[0]).toBeCloseTo(100 + gap)
      expect(b.pos[1]).toBe(0)
    }
  )

  it.for([
    { canvas: 'an editable canvas', isReadOnly: false, canTidy: true },
    { canvas: 'a read-only canvas', isReadOnly: true, canTidy: false }
  ])(
    'lets two selected nodes be tidied on $canvas: $canTidy',
    ({ isReadOnly, canTidy }) => {
      setCanvasSelection([new LGraphNode('A'), new LGraphNode('B')])
      useCanvasStore().isReadOnly = isReadOnly

      expect(useSelectionGrid().canTidy.value).toBe(canTidy)
    }
  )

  it('measures only nodes that are unpinned and on the shown graph when it runs', () => {
    const graph = new LGraph()
    const a = nodeIn(graph, 'A')
    const b = nodeIn(graph, 'B')
    const pinnedLater = nodeIn(graph, 'Pinned later')
    const unpinnedLater = nodeIn(graph, 'Unpinned later')
    const elsewhere = nodeIn(new LGraph(), 'Elsewhere')
    unpinnedLater.flags.pinned = true
    useCanvasStore().canvas = fromPartial<LGraphCanvas>({ graph })
    setCanvasSelection([a, b, pinnedLater, unpinnedLater, elsewhere])
    const { canTidy, measure } = useSelectionGrid()
    expect(canTidy.value).toBe(true)

    pinnedLater.flags.pinned = true
    unpinnedLater.flags.pinned = false

    expect(measure().map((box) => box.id)).toEqual([
      a.id,
      b.id,
      unpinnedLater.id
    ])
  })

  it.for([
    {
      nodes: 'a pinned node',
      pinned: true,
      isReadOnly: false,
      moved: false,
      position: [100, 200]
    },
    {
      nodes: 'a movable node',
      pinned: false,
      isReadOnly: false,
      moved: true,
      position: [10, 40]
    },
    {
      nodes: 'a read-only node',
      pinned: false,
      isReadOnly: true,
      moved: false,
      position: [100, 200]
    }
  ])(
    'reports a move for $nodes: $moved',
    ({ pinned, isReadOnly, moved, position }) => {
      const graph = new LGraph()
      const node = nodeIn(graph, 'Node')
      node.pos = [100, 200]
      node.flags.pinned = pinned
      const canvasStore = useCanvasStore()
      canvasStore.canvas = fromPartial<LGraphCanvas>({
        graph,
        setDirty: vi.fn()
      })
      canvasStore.currentGraph = graph
      canvasStore.isReadOnly = isReadOnly
      const { moveBoxes } = useSelectionGrid()

      expect(
        moveBoxes([node], [{ id: node.id, x: 10, y: 10 }], {
          captureUndo: false
        })
      ).toBe(moved)
      expect(Array.from(node.pos)).toEqual(position)
    }
  )

  it('spaces nodes by rendered size when content has grown past size', () => {
    const graph = new LGraph()
    const a = nodeIn(graph, 'A')
    const b = nodeIn(graph, 'B')
    a.pos = [0, 0]
    b.pos = [0, 250]
    a.size = [100, 50]
    b.size = [100, 50]
    bindMountedNodeSize(graph, a.id, () => {}).report(
      { width: 100, height: 200 },
      false
    )
    const previousMode = LiteGraph.vueNodesMode
    LiteGraph.vueNodesMode = true
    onTestFinished(() => {
      LiteGraph.vueNodesMode = previousMode
    })
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({ graph, setDirty: vi.fn() })
    canvasStore.currentGraph = graph

    useSelectionGrid().tidyUp([a, b], { gap: 12, captureUndo: false })

    expect(Array.from(a.size)).toEqual([100, 50])
    expect(Array.from(a.pos)).toEqual([0, 0])
    expect(Array.from(b.pos)).toEqual([0, 242])
  })

  it('carries a reroute along when both ends of its link are tidied, and leaves one leading outside', () => {
    const graph = new LGraph()
    const a = nodeIn(graph, 'A')
    const b = nodeIn(graph, 'B')
    const outside = nodeIn(graph, 'Outside')
    a.addOutput('out', 'MODEL')
    b.addInput('in', 'MODEL')
    outside.addInput('in', 'MODEL')
    a.pos = [0, 0]
    b.pos = [300, 0]
    a.size = [100, 100]
    b.size = [100, 100]
    outside.pos = [600, 300]
    const [outX, outY] = a.getOutputPos(0)
    const [inX, inY] = b.getInputPos(0)
    const threeQuartersAlong: [number, number] = [
      outX + 0.75 * (inX - outX),
      outY + 0.75 * (inY - outY)
    ]
    const enclosed = graph.createReroute(
      threeQuartersAlong,
      createTestLink(graph, a, 0, b, 0)
    )
    const leading = graph.createReroute(
      [400, 200],
      createTestLink(graph, a, 0, outside, 0)
    )
    assert.exists(enclosed)
    assert.exists(leading)
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({ graph, setDirty: vi.fn() })
    canvasStore.currentGraph = graph

    useSelectionGrid().tidyUp([a, b], { gap: 12, captureUndo: false })

    expect(Array.from(b.pos)).toEqual([112, 0])
    expect(enclosed.pos[0]).toBeCloseTo(threeQuartersAlong[0] - 141)
    expect(enclosed.pos[1]).toBeCloseTo(threeQuartersAlong[1])
    expect(Array.from(leading.pos)).toEqual([400, 200])
  })

  it('keeps an off-end reroute near its socket when nearly coincident sockets separate', () => {
    const graph = new LGraph()
    const a = nodeIn(graph, 'A')
    const b = nodeIn(graph, 'B')
    a.addOutput('out', 'MODEL')
    b.addInput('in', 'MODEL')
    a.pos = [0, 0]
    a.size = [100, 100]
    b.size = [100, 100]
    b.pos = [0, 0]
    b.pos = [a.getOutputPos(0)[0] - b.getInputPos(0)[0] + 0.001, 0]
    const [x, y] = b.getInputPos(0)
    const reroute = graph.createReroute(
      [x + 109, y + 60],
      createTestLink(graph, a, 0, b, 0)
    )
    assert.exists(reroute)
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({ graph, setDirty: vi.fn() })
    canvasStore.currentGraph = graph

    useSelectionGrid().tidyUp([a, b], { gap: 12, captureUndo: false })

    expect(b.getInputPos(0)[0]).toBeGreaterThan(x + 20)
    expect(reroute.pos[0] - b.getInputPos(0)[0]).toBeCloseTo(109)
    expect(reroute.pos[1]).toBeCloseTo(y + 60)
  })

  it('places an off-axis reroute at the same target with or without an intermediate move', () => {
    const graph = new LGraph()
    const a = nodeIn(graph, 'A')
    const b = nodeIn(graph, 'B')
    a.addOutput('out', 'MODEL')
    b.addInput('in', 'MODEL')
    a.pos = [0, 0]
    b.pos = [300, 40]
    a.size = [100, 100]
    b.size = [100, 100]
    const reroute = graph.createReroute(
      [200.5, 114],
      createTestLink(graph, a, 0, b, 0)
    )
    assert.exists(reroute)
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({ graph, setDirty: vi.fn() })
    canvasStore.currentGraph = graph
    const { capturePositions, measure, moveBoxes } = useSelectionGrid()
    const nodes = [a, b]
    const [first, second] = measure(nodes)
    const restore = capturePositions(nodes)
    const target = [first, { ...second, x: second.x + 300 }]
    moveBoxes(nodes, target, { captureUndo: false })
    const direct = [...reroute.pos]
    restore()

    const finish = capturePositions(nodes)
    moveBoxes(nodes, [first, { ...second, x: second.x + 150 }], {
      captureUndo: false
    })
    moveBoxes(nodes, target, { captureUndo: false })
    finish('commit')

    expect([...reroute.pos]).toEqual(direct)
  })

  it('restores a reroute that becomes enclosed but preserves an independent reroute move', () => {
    const graph = new LGraph()
    const a = nodeIn(graph, 'A')
    const b = nodeIn(graph, 'B')
    const outside = nodeIn(graph, 'Outside')
    a.addOutput('out', 'MODEL')
    b.addInput('in', 'MODEL')
    b.addInput('second', 'MODEL')
    outside.addInput('in', 'MODEL')
    a.pos = [0, 0]
    b.pos = [300, 0]
    const internalLink = a.connect(0, b, 1)
    assert.exists(internalLink)
    const reroute = graph.createReroute(
      [225, 50],
      createTestLink(graph, a, 0, b, 0)
    )
    const becomesEnclosed = graph.createReroute([400, 200], internalLink)
    assert.exists(reroute)
    assert.exists(becomesEnclosed)
    const outsideLink = a.connect(0, outside, 0, becomesEnclosed.id)
    assert.exists(outsideLink)
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({ graph, setDirty: vi.fn() })
    canvasStore.currentGraph = graph
    const { capturePositions, tidyUp } = useSelectionGrid()
    const restore = capturePositions([a, b])

    tidyUp([a, b], { gap: 12, captureUndo: false })
    expect([...becomesEnclosed.pos]).toEqual([400, 200])
    outside.disconnectInput(0)
    reroute.move(4, 7)
    const independentlyMoved = [...reroute.pos]
    tidyUp([a, b], { gap: 24, captureUndo: false })
    expect([...becomesEnclosed.pos]).not.toEqual([400, 200])
    restore()

    expect(Array.from(b.pos)).toEqual([300, 0])
    expect(Array.from(reroute.pos)).toEqual(independentlyMoved)
    expect(Array.from(becomesEnclosed.pos)).toEqual([400, 200])
    expect(graph.getLink(outsideLink.id)).toBeUndefined()
  })

  it('moves the drawn bounds to the target while preserving their offset from the raw position', () => {
    const graph = new LGraph()
    const node = nodeIn(graph, 'Node')
    node.pos = [100, 200]
    node.onBounding = (bounds) => {
      bounds[0] -= 15
      bounds[1] -= 25
    }
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({ graph, setDirty: vi.fn() })
    canvasStore.currentGraph = graph
    const { measure, moveBoxes } = useSelectionGrid()
    const [before] = measure([node])
    expect(before).toBeDefined()

    expect(
      moveBoxes([node], [{ id: node.id, x: 300, y: 400 }], {
        captureUndo: false
      })
    ).toBe(true)

    expect(measure([node])).toEqual([{ ...before, x: 300, y: 400 }])
    expect(Array.from(node.pos)).toEqual([315, 455])
  })
})
