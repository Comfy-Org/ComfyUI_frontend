import { tryOnScopeDispose } from '@vueuse/core'
import { isEqual } from 'es-toolkit'
import { readonly, ref } from 'vue'

import {
  computeGapBars,
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
import type { NodeId } from '@/types/nodeId'

interface GapDrag {
  barKey: string
  axis: GapAxis
  gap: number
}

interface DragStart {
  bar: GapBar
  grid: SelectionGrid
  nodeIds: NodeId[]
  positions: BoxPosition[]
  startGap: number
  previewed: boolean
}

const clampBarGap = (bar: GapBar, gap: number): number =>
  Math.max(bar.gap - bar.clearance, gap)

const shiftFor = (bar: GapBar, gap: number): number =>
  clampBarGap(bar, gap) - bar.gap

export function useGapDragSession() {
  const { gridNodes, measure, moveBoxes, recordUndoStep } = useSelectionGrid()

  const drag = ref<GapDrag | null>(null)
  let dragStart: DragStart | null = null
  let pendingFrame: number | null = null

  const selectedIds = () => gridNodes.value.map((node) => node.id)

  const isSameSelection = (origin: DragStart) =>
    isEqual(selectedIds(), origin.nodeIds)

  const currentBar = (key: string) => {
    const boxes = measure()
    const grid = detectSelectionGrid(boxes)
    const bar = computeGapBars(grid).find((candidate) => candidate.key === key)
    return bar && { bar, grid, boxes }
  }

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

  const cancel = () => {
    const origin = dragStart
    if (origin?.previewed && isSameSelection(origin)) {
      cancelPendingFrame()
      moveBoxes(origin.positions, { captureUndo: false })
    }
    end()
  }

  const start = (bar: GapBar) => {
    cancel()
    const current = currentBar(bar.key)
    if (!current) return
    const startGap = Math.round(current.bar.gap)
    dragStart = {
      bar: current.bar,
      grid: current.grid,
      nodeIds: selectedIds(),
      positions: current.boxes.map(({ id, x, y }) => ({ id, x, y })),
      startGap,
      previewed: false
    }
    drag.value = {
      barKey: current.bar.key,
      axis: current.bar.axis,
      gap: startGap
    }
  }

  const preview = (delta: number) => {
    const current = drag.value
    const origin = dragStart
    if (!current || !origin) return
    const gap = clampBarGap(origin.bar, origin.startGap + Math.round(delta))
    if (gap === current.gap) return
    drag.value = { ...current, gap }
    origin.previewed = true
    cancelPendingFrame()
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null
      if (isSameSelection(origin)) {
        moveBoxes(layoutFor(origin, gap), { captureUndo: false })
      } else {
        end()
      }
    })
  }

  const commit = () => {
    const current = drag.value
    const origin = dragStart
    if (!current || !origin || current.gap === origin.startGap) {
      cancel()
      return
    }
    if (isSameSelection(origin)) {
      cancelPendingFrame()
      moveBoxes(layoutFor(origin, current.gap), { captureUndo: true })
    }
    end()
  }

  const nudge = (bar: GapBar, step: number) => {
    if (dragStart) return
    const current = currentBar(bar.key)
    if (!current) return
    moveBoxes(
      computeGapLayout(
        current.grid,
        current.bar.axis,
        current.bar.gutter,
        shiftFor(current.bar, Math.round(current.bar.gap) + step)
      ),
      { captureUndo: false }
    )
  }

  tryOnScopeDispose(cancel)

  return {
    drag: readonly(drag),
    start,
    preview,
    commit,
    cancel,
    nudge,
    commitNudges: recordUndoStep
  }
}
