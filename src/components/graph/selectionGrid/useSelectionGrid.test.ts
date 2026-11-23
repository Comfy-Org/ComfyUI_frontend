import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { bindMountedNodeSize } from '@/renderer/core/layout/store/mountedNodeSizes'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'
import { createTestLink } from '@/utils/__tests__/litegraphTestUtils'

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

  it('puts carried reroutes back when captured positions are restored', () => {
    const graph = new LGraph()
    const a = nodeIn(graph, 'A')
    const b = nodeIn(graph, 'B')
    const outside = nodeIn(graph, 'Outside')
    a.addOutput('out', 'MODEL')
    b.addInput('in', 'MODEL')
    outside.addInput('in', 'MODEL')
    a.pos = [0, 0]
    b.pos = [300, 0]
    const reroute = graph.createReroute(
      [225, 50],
      createTestLink(graph, a, 0, b, 0)
    )
    const unrelated = graph.createReroute(
      [400, 200],
      createTestLink(graph, a, 0, outside, 0)
    )
    assert.exists(reroute)
    assert.exists(unrelated)
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({ graph, setDirty: vi.fn() })
    canvasStore.currentGraph = graph
    const { capturePositions, tidyUp } = useSelectionGrid()
    const restore = capturePositions([a, b])

    tidyUp([a, b], { gap: 12, captureUndo: false })
    unrelated.move(4, 7)
    restore()

    expect(Array.from(b.pos)).toEqual([300, 0])
    expect(Array.from(reroute.pos)).toEqual([225, 50])
    expect(Array.from(unrelated.pos)).toEqual([404, 207])
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
