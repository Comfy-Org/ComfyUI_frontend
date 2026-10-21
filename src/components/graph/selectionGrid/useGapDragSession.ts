import { readonly, ref } from 'vue'

import {
  computeGapLayout,
  detectSelectionGrid
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type {
  BoxPosition,
  GapAxis,
  GapBar,
  SelectionGrid
} from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'

interface GapDrag {
  barKey: string
  axis: GapAxis
  gap: number
}

interface DragStart {
  bar: GapBar
  grid: SelectionGrid
  positions: BoxPosition[]
  previewed: boolean
}

const clampBarGap = (bar: GapBar, gap: number): number =>
  Math.max(bar.gap - bar.clearance, gap)

const shiftFor = (bar: GapBar, gap: number): number =>
  clampBarGap(bar, gap) - bar.gap

export function useGapDragSession() {
  const { measure, moveBoxes } = useSelectionGrid()

  const drag = ref<GapDrag | null>(null)
  let dragStart: DragStart | null = null
  let pendingFrame: number | null = null

  const cancelPendingFrame = () => {
    if (pendingFrame === null) return
    cancelAnimationFrame(pendingFrame)
    pendingFrame = null
  }

  const end = () => {
    cancelPendingFrame()
    drag.value = null
    dragStart = null
  }

  const layoutFor = (origin: DragStart, gap: number) =>
    computeGapLayout(
      origin.grid,
      origin.bar.axis,
      origin.bar.gutter,
      shiftFor(origin.bar, gap)
    )

  const start = (bar: GapBar) => {
    const boxes = measure()
    dragStart = {
      bar,
      grid: detectSelectionGrid(boxes),
      positions: boxes.map(({ id, x, y }) => ({ id, x, y })),
      previewed: false
    }
    drag.value = { barKey: bar.key, axis: bar.axis, gap: bar.gap }
  }

  const preview = (delta: number) => {
    const current = drag.value
    const origin = dragStart
    if (!current || !origin) return
    const gap = clampBarGap(origin.bar, Math.round(origin.bar.gap + delta))
    if (gap === current.gap) return
    drag.value = { ...current, gap }
    origin.previewed = true
    cancelPendingFrame()
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null
      moveBoxes(layoutFor(origin, gap), { captureUndo: false })
    })
  }

  const commit = () => {
    const current = drag.value
    const origin = dragStart
    if (current && origin?.previewed) {
      cancelPendingFrame()
      moveBoxes(layoutFor(origin, current.gap), { captureUndo: true })
    }
    end()
  }

  const cancel = () => {
    if (dragStart?.previewed) {
      cancelPendingFrame()
      moveBoxes(dragStart.positions, { captureUndo: false })
    }
    end()
  }

  const nudge = (bar: GapBar, step: number) => {
    moveBoxes(
      computeGapLayout(
        detectSelectionGrid(measure()),
        bar.axis,
        bar.gutter,
        shiftFor(bar, Math.round(bar.gap) + step)
      ),
      { captureUndo: true }
    )
  }

  return { drag: readonly(drag), start, preview, commit, cancel, nudge }
}
