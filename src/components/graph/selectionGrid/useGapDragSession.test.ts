import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, shallowRef } from 'vue'

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
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'

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

const firstBarOf = (boxes: LayoutBox[]): GapBar => {
  const bar = computeGapBars(detectSelectionGrid(boxes)).at(0)
  if (!bar) throw new Error('expected a gap bar')
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
  const moveBoxes = vi.fn()
  const recordUndoStep = vi.fn()
  const selectedNodes = shallowRef<LGraphNode[]>([])
  let measuredBoxes: LayoutBox[] = []
  let frameCallbacks: FrameRequestCallback[]

  const selectBoxes = (boxes: LayoutBox[]) => {
    measuredBoxes = boxes
    selectedNodes.value = nodesFor(boxes)
  }

  beforeEach(() => {
    vi.mocked(useSelectionGrid).mockImplementation(() => ({
      gridNodes: computed(() => selectedNodes.value),
      canTidy: computed(() => true),
      measure: () => measuredBoxes,
      moveBoxes,
      recordUndoStep,
      tidyUp: vi.fn()
    }))
    selectBoxes(row)
    frameCallbacks = []
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      frameCallbacks.push(cb)
      return frameCallbacks.length
    })
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
      frameCallbacks[id - 1] = () => {}
    })
  })

  const flushFrames = () => {
    const callbacks = frameCallbacks
    frameCallbacks = []
    callbacks.forEach((cb) => cb(performance.now()))
  }

  it('previews the dragged gap once per frame without an undo step', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))

    session.preview(5)
    session.preview(12.4)
    flushFrames()

    expect(session.drag.value?.gap).toBe(42)
    expect(moveBoxes).toHaveBeenCalledTimes(1)
    expect(moveBoxes).toHaveBeenCalledWith(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 242, y: 10 },
        { id: 'c', x: 412, y: 0 }
      ],
      { captureUndo: false }
    )
  })

  it('commits the dragged gap as one undo step', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))
    session.preview(10)

    session.commit()
    flushFrames()

    expect(moveBoxes).toHaveBeenCalledTimes(1)
    expect(moveBoxes).toHaveBeenCalledWith(expect.any(Array), {
      captureUndo: true
    })
    expect(session.drag.value).toBeNull()
  })

  it('puts every node back when the drag is cancelled', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))
    session.preview(10)
    flushFrames()
    moveBoxes.mockClear()

    session.cancel()

    expect(moveBoxes).toHaveBeenCalledWith(positionsOf(row), {
      captureUndo: false
    })
    expect(session.drag.value).toBeNull()
  })

  it('puts the previous drag back before it starts another', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))
    session.preview(10)
    flushFrames()
    moveBoxes.mockClear()

    session.start(firstBarOf(row))
    flushFrames()

    expect(moveBoxes).toHaveBeenCalledTimes(1)
    expect(moveBoxes).toHaveBeenCalledWith(positionsOf(row), {
      captureUndo: false
    })
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
  })

  it('puts every node back when a drag returns to where it started', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))
    session.preview(10)
    flushFrames()
    session.preview(0)
    moveBoxes.mockClear()

    session.commit()

    expect(moveBoxes).toHaveBeenCalledTimes(1)
    expect(moveBoxes).toHaveBeenCalledWith(positionsOf(row), {
      captureUndo: false
    })
  })

  it('stops without moving nodes when the selection changes during a drag', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))
    session.preview(10)

    selectBoxes(gridWithWideNode)
    flushFrames()
    session.commit()

    expect(moveBoxes).not.toHaveBeenCalled()
    expect(session.drag.value).toBeNull()
  })

  it('puts every node back when its owner goes away during a drag', () => {
    const scope = effectScope()
    const session = scope.run(() => useGapDragSession())
    if (!session) throw new Error('the session did not start in its scope')
    session.start(firstBarOf(row))
    session.preview(10)
    flushFrames()
    moveBoxes.mockClear()

    scope.stop()

    expect(moveBoxes).toHaveBeenCalledWith(positionsOf(row), {
      captureUndo: false
    })
  })

  it('leaves the layout alone when the bar is released without moving', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))

    session.preview(0.3)
    session.commit()
    flushFrames()

    expect(moveBoxes).not.toHaveBeenCalled()
  })

  it('keeps the gap at zero or more', () => {
    const session = useGapDragSession()
    session.start(firstBarOf(row))

    session.preview(-80)

    expect(session.drag.value?.gap).toBe(0)
  })

  it('stops shrinking a gap when the widest nodes of the two columns touch', () => {
    selectBoxes(gridWithWideNode)
    const session = useGapDragSession()
    session.start(firstBarOf(gridWithWideNode))

    session.preview(-100)
    flushFrames()

    expect(session.drag.value?.gap).toBe(40)
    expect(moveBoxes).toHaveBeenCalledWith(
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

      expect(moveBoxes).toHaveBeenNthCalledWith(
        1,
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 200, y: 0 }
        ],
        { captureUndo: false }
      )
      expect(moveBoxes).toHaveBeenNthCalledWith(
        2,
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 200, y: 0 }
        ],
        { captureUndo: false }
      )
    })

    it('leaves the undo step to commitNudges', () => {
      const session = useGapDragSession()

      session.nudge(firstBarOf(row), 1)
      session.nudge(firstBarOf(row), 1)
      session.commitNudges()

      expect(moveBoxes).toHaveBeenCalledTimes(2)
      expect(recordUndoStep).toHaveBeenCalledTimes(1)
    })

    it('does nothing during a drag', () => {
      const session = useGapDragSession()
      session.start(firstBarOf(row))

      session.nudge(firstBarOf(row), 1)

      expect(moveBoxes).not.toHaveBeenCalled()
    })
  })
})
