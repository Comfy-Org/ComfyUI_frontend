import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, shallowRef } from 'vue'

import {
  computeGapBars,
  detectSelectionGrid
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type {
  GapBar,
  LayoutBox
} from '@/components/graph/selectionGrid/selectionGridLayout'
import { useGapDragSession } from '@/components/graph/selectionGrid/useGapDragSession'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

vi.mock(import('@/components/graph/selectionGrid/useSelectionGrid'), {
  spy: true
})

const row: LayoutBox[] = [
  { id: toNodeId('a'), x: 0, y: 0, width: 200, height: 100 },
  { id: toNodeId('b'), x: 230, y: 10, width: 150, height: 100 },
  { id: toNodeId('c'), x: 400, y: 0, width: 100, height: 100 }
]

const gridWithWideNode: LayoutBox[] = [
  { id: toNodeId('a'), x: 0, y: 0, width: 200, height: 100 },
  { id: toNodeId('b'), x: 260, y: 0, width: 120, height: 100 },
  { id: toNodeId('c'), x: 0, y: 140, width: 240, height: 100 },
  { id: toNodeId('d'), x: 260, y: 140, width: 120, height: 100 }
]

const nearlyTouchingGrid: LayoutBox[] = [
  { id: toNodeId('a'), x: 0, y: 0, width: 200, height: 100 },
  { id: toNodeId('b'), x: 260.4, y: 0, width: 120, height: 100 },
  { id: toNodeId('c'), x: 0, y: 140, width: 260.3, height: 100 },
  { id: toNodeId('d'), x: 260.4, y: 140, width: 120, height: 100 }
]

const firstBarOf = (boxes: LayoutBox[]): GapBar => {
  const bar = computeGapBars(detectSelectionGrid(boxes)).at(0)
  assert.exists(bar)
  return bar
}

const nodesFor = (boxes: LayoutBox[]) =>
  boxes.map(({ id }) => {
    const node = new LGraphNode(id)
    node.id = id
    return node
  })

const positionsOf = (boxes: LayoutBox[]) =>
  boxes.map(({ id, x, y }) => ({ id, x, y }))

describe('useGapDragSession', () => {
  const placeBoxes = vi.fn()
  const moveBoxes = vi.fn<ReturnType<typeof useSelectionGrid>['moveBoxes']>(
    () => true
  )
  const recordUndoStep = vi.fn()
  const selectedNodes = shallowRef<LGraphNode[]>([])
  let measuredBoxes: LayoutBox[] = []
  let rowNodes: LGraphNode[]

  const selectBoxes = (boxes: LayoutBox[]) => {
    measuredBoxes = boxes
    selectedNodes.value = nodesFor(boxes)
    return selectedNodes.value
  }

  beforeEach(() => {
    vi.mocked(useSelectionGrid).mockImplementation(() => ({
      gridNodes: computed(() => selectedNodes.value),
      canTidy: computed(() => true),
      measure: () => measuredBoxes,
      capturePositions: (nodes) => {
        const positions = positionsOf(measuredBoxes)
        return () => placeBoxes(nodes, positions)
      },
      moveBoxes,
      recordUndoStep,
      tidyUp: vi.fn()
    }))
    rowNodes = selectBoxes(row)
  })

  const flushFrames = () => vi.advanceTimersToNextFrame()

  it('previews the dragged gap once per frame without an undo step', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))

    session.preview(5)
    session.preview(12.4)
    flushFrames()

    expect(session.drag.value?.gap).toBe(42)
    expect(moveBoxes).toHaveBeenCalledTimes(1)
    expect(moveBoxes).toHaveBeenCalledWith(
      rowNodes,
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 242, y: 10 },
        { id: 'c', x: 412, y: 0 }
      ],
      { captureUndo: false }
    )
  })

  it('puts every node back when the drag is cancelled', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))
    session.preview(10)
    flushFrames()

    session.cancel()

    expect(placeBoxes).toHaveBeenCalledWith(rowNodes, positionsOf(row))
    expect(session.drag.value).toBeNull()
  })

  it('puts the previous drag back before it starts another', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))
    session.preview(10)
    flushFrames()

    session.start(firstBarOf(row))
    flushFrames()

    expect(placeBoxes).toHaveBeenCalledTimes(1)
    expect(placeBoxes).toHaveBeenCalledWith(rowNodes, positionsOf(row))
  })

  it('reads a fractional gap as its whole number, so a press without a move changes nothing', () => {
    const fractionalRow = [
      { id: toNodeId('a'), x: 0, y: 0, width: 200, height: 100 },
      { id: toNodeId('b'), x: 230.6, y: 0, width: 150, height: 100 }
    ]
    selectBoxes(fractionalRow)
    const session = useGapDragSession()
    session.start(firstBarOf(fractionalRow))

    session.preview(-0.1)
    session.commit()
    flushFrames()

    expect(session.drag.value).toBeNull()
    expect(moveBoxes).not.toHaveBeenCalled()
    expect(placeBoxes).not.toHaveBeenCalled()
  })

  it('puts every node back when a drag returns to where it started', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))
    session.preview(10)
    flushFrames()
    session.preview(0)

    session.commit()

    expect(placeBoxes).toHaveBeenCalledTimes(1)
    expect(placeBoxes).toHaveBeenCalledWith(rowNodes, positionsOf(row))
  })

  it('keeps moving the nodes it started with when the selection changes', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))
    session.preview(10)

    selectBoxes(gridWithWideNode)
    flushFrames()
    session.commit()

    expect(moveBoxes).toHaveBeenCalled()
    expect(moveBoxes.mock.calls.map(([nodes]) => nodes)).toEqual(
      moveBoxes.mock.calls.map(() => rowNodes)
    )
  })

  it('puts the nodes it started with back when it is cancelled after the selection changes', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))
    session.preview(10)
    flushFrames()

    selectBoxes(gridWithWideNode)
    session.cancel()

    expect(placeBoxes).toHaveBeenCalledWith(rowNodes, positionsOf(row))
  })

  it('puts every node back when its owner goes away during a drag', () => {
    const scope = effectScope()
    const session = scope.run(() => useGapDragSession())
    assert.exists(session)
    session.start(firstBarOf(row))
    session.preview(10)
    flushFrames()

    scope.stop()

    expect(placeBoxes).toHaveBeenCalledWith(rowNodes, positionsOf(row))
  })

  it('leaves the layout alone when the bar is released without moving', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))

    session.preview(0.3)
    session.commit()
    flushFrames()

    expect(moveBoxes).not.toHaveBeenCalled()
  })

  it('ignores a drag distance that is not a number', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))

    session.preview(Number.NaN)
    flushFrames()

    expect(session.drag.value?.gap).toBe(30)
    expect(moveBoxes).not.toHaveBeenCalled()
  })

  it('restores the dragged nodes once another graph is shown', async () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))
    session.preview(10)
    flushFrames()

    useCanvasStore().currentGraph = new LGraph()
    await nextTick()
    session.commit()
    session.cancel()

    expect(session.drag.value).toBeNull()
    expect(moveBoxes).toHaveBeenCalledTimes(1)
    expect(placeBoxes).toHaveBeenCalledWith(rowNodes, positionsOf(row))
  })

  it('does not start a drag on a read-only canvas', () => {
    useCanvasStore().isReadOnly = true
    const session = useGapDragSession()

    session.start(firstBarOf(row))

    expect(session.drag.value).toBeNull()
  })

  it('puts every node back when the release cannot move them', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))
    session.preview(10)
    flushFrames()
    moveBoxes.mockReturnValue(false)

    session.commit()

    expect(placeBoxes).toHaveBeenCalledWith(rowNodes, positionsOf(row))
    expect(session.drag.value).toBeNull()
  })

  it('rests at its whole starting gap when nodes beyond it nearly touch', () => {
    selectBoxes(nearlyTouchingGrid)
    const session = useGapDragSession()
    session.start(firstBarOf(nearlyTouchingGrid))

    session.preview(0)
    session.preview(-5)
    flushFrames()

    expect(session.drag.value?.gap).toBe(60)
    expect(moveBoxes).not.toHaveBeenCalled()
  })

  it('stops a fractional gap a whole step before the nodes beyond it would overlap', () => {
    const fractionalGrid: LayoutBox[] = [
      { id: toNodeId('a'), x: 0, y: 0, width: 200, height: 100 },
      { id: toNodeId('b'), x: 260.4, y: 0, width: 120, height: 100 },
      { id: toNodeId('c'), x: 0, y: 140, width: 240.3, height: 100 },
      { id: toNodeId('d'), x: 260.4, y: 140, width: 120, height: 100 }
    ]
    selectBoxes(fractionalGrid)
    const session = useGapDragSession()
    session.start(firstBarOf(fractionalGrid))

    session.preview(-100)

    expect(session.drag.value?.gap).toBe(41)
  })

  it('keeps the gap at zero or more', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))

    session.preview(-80)

    expect(session.drag.value?.gap).toBe(0)
  })

  it('stops shrinking a gap when the widest nodes of the two columns touch', () => {
    const gridNodes = selectBoxes(gridWithWideNode)
    const session = useGapDragSession()
    session.start(firstBarOf(gridWithWideNode))

    session.preview(-100)
    flushFrames()

    expect(session.drag.value?.gap).toBe(40)
    expect(moveBoxes).toHaveBeenCalledWith(
      gridNodes,
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 240, y: 0 },
        { id: 'c', x: 0, y: 140 },
        { id: 'd', x: 240, y: 140 }
      ],
      { captureUndo: false }
    )
  })

  describe('nudge', () => {
    const tightRow = [
      { id: toNodeId('a'), x: 0, y: 0, width: 200, height: 100 },
      { id: toNodeId('b'), x: 205, y: 0, width: 150, height: 100 }
    ]

    it('measures the gap again on each press instead of trusting the bar it is given', () => {
      selectBoxes(tightRow)
      const session = useGapDragSession()
      const staleBar = firstBarOf(tightRow)

      session.nudge(staleBar, -10)
      selectBoxes([tightRow[0], { ...tightRow[1], x: 200 }])
      session.nudge(staleBar, -10)

      expect(moveBoxes.mock.calls.map(([, positions]) => positions)).toEqual([
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 200, y: 0 }
        ]
      ])
    })

    it('records one undo step for the nudges since the last commit', () => {
      const session = useGapDragSession()

      session.nudge(firstBarOf(row), 1)
      session.nudge(firstBarOf(row), 1)

      expect(session.commitNudges()).toBe(true)
      expect(session.commitNudges()).toBe(false)
      expect(moveBoxes).toHaveBeenCalledTimes(2)
      expect(recordUndoStep).toHaveBeenCalledTimes(1)
    })

    it('records the nudges it has not committed when its owner goes away', () => {
      const scope = effectScope()
      const session = scope.run(() => useGapDragSession())
      assert.exists(session)
      session.nudge(firstBarOf(row), 1)

      scope.stop()

      expect(recordUndoStep).toHaveBeenCalledTimes(1)
    })

    it('neither nudges nor records an undo step during a drag', () => {
      const session = useGapDragSession()
      session.start(firstBarOf(row))

      session.nudge(firstBarOf(row), 1)

      expect(session.commitNudges()).toBe(false)
      expect(moveBoxes).not.toHaveBeenCalled()
      expect(recordUndoStep).not.toHaveBeenCalled()
    })

    it('records its nudges when another graph is shown', async () => {
      const session = useGapDragSession()
      session.nudge(firstBarOf(row), 1)

      useCanvasStore().currentGraph = new LGraph()
      await nextTick()

      expect(recordUndoStep).toHaveBeenCalledTimes(1)
      expect(session.commitNudges()).toBe(false)
    })

    it('leaves the nodes alone when a press cannot shrink the gap by a whole step', () => {
      selectBoxes(nearlyTouchingGrid)
      const session = useGapDragSession()

      session.nudge(firstBarOf(nearlyTouchingGrid), -1)

      expect(moveBoxes).not.toHaveBeenCalled()
      expect(session.commitNudges()).toBe(false)
    })

    it('ignores a step that is not a number', () => {
      const session = useGapDragSession()

      session.nudge(firstBarOf(row), Number.POSITIVE_INFINITY)

      expect(moveBoxes).not.toHaveBeenCalled()
      expect(session.commitNudges()).toBe(false)
    })
  })
})
