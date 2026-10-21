import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

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

describe('useGapDragSession', () => {
  const moveBoxes = vi.fn()
  let frameCallbacks: FrameRequestCallback[]

  const selectBoxes = (boxes: LayoutBox[]) => {
    vi.mocked(useSelectionGrid).mockImplementation(() => ({
      gridNodes: computed(() => []),
      canTidy: computed(() => true),
      measure: () => boxes,
      moveBoxes,
      tidyUp: vi.fn()
    }))
  }

  beforeEach(() => {
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

    expect(moveBoxes).toHaveBeenCalledWith(
      row.map(({ id, x, y }) => ({ id, x, y })),
      { captureUndo: false }
    )
    expect(session.drag.value).toBeNull()
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
})
