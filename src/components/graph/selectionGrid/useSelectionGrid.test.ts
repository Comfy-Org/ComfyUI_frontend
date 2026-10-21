import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'

const nodeIn = (graph: LGraph, title: string) => {
  const node = new LGraphNode(title)
  graph.add(node)
  return node
}

describe('useSelectionGrid', () => {
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
    { nodes: 'a pinned node', pinned: true, moved: false },
    { nodes: 'a movable node', pinned: false, moved: true }
  ])('reports a move for $nodes: $moved', ({ pinned, moved }) => {
    const graph = new LGraph()
    const node = nodeIn(graph, 'Node')
    node.flags.pinned = pinned
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({ graph, setDirty: vi.fn() })
    canvasStore.currentGraph = graph
    const { moveBoxes } = useSelectionGrid()

    expect(
      moveBoxes([node], [{ id: node.id, x: 10, y: 10 }], { captureUndo: false })
    ).toBe(moved)
  })
})
