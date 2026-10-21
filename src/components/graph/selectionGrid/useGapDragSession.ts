import { tryOnScopeDispose } from '@vueuse/core'
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
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

interface GapDrag {
  barKey: string
  axis: GapAxis
  gap: number
}

interface DragStart {
  bar: GapBar
  grid: SelectionGrid
  nodes: LGraphNode[]
  positions: BoxPosition[]
  startGap: number
  previewed: boolean
}

function clampBarGap(bar: GapBar, gap: number): number {
  return Math.max(bar.gap - bar.clearance, gap)
}

function shiftFor(bar: GapBar, gap: number): number {
  return clampBarGap(bar, gap) - bar.gap
}

export function useGapDragSession() {
  const { gridNodes, measure, placeBoxes, moveBoxes, recordUndoStep } =
    useSelectionGrid()

  const drag = ref<GapDrag | null>(null)
  let dragStart: DragStart | null = null
  let pendingFrame: number | null = null
  let hasUncommittedNudges = false

  const currentBar = (nodes: LGraphNode[], key: string) => {
    const boxes = measure(nodes)
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
    if (origin?.previewed) {
      cancelPendingFrame()
      placeBoxes(origin.nodes, origin.positions)
    }
    end()
  }

  const commitNudges = (): boolean => {
    if (dragStart || !hasUncommittedNudges) return false
    hasUncommittedNudges = false
    recordUndoStep()
    return true
  }

  const start = (bar: GapBar) => {
    cancel()
    commitNudges()
    const nodes = [...gridNodes.value]
    const current = currentBar(nodes, bar.key)
    if (!current) return
    const startGap = Math.round(current.bar.gap)
    dragStart = {
      bar: current.bar,
      grid: current.grid,
      nodes,
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
    if (!current || !origin || !Number.isFinite(delta)) return
    const gap = clampBarGap(origin.bar, origin.startGap + Math.round(delta))
    if (gap === current.gap) return
    drag.value = { ...current, gap }
    origin.previewed = true
    cancelPendingFrame()
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null
      moveBoxes(origin.nodes, layoutFor(origin, gap), { captureUndo: false })
    })
  }

  const commit = () => {
    const current = drag.value
    const origin = dragStart
    if (!current || !origin || current.gap === origin.startGap) {
      cancel()
      return
    }
    cancelPendingFrame()
    moveBoxes(origin.nodes, layoutFor(origin, current.gap), {
      captureUndo: true
    })
    end()
  }

  const nudge = (bar: GapBar, step: number) => {
    if (dragStart || !Number.isFinite(step)) return
    const nodes = [...gridNodes.value]
    const current = currentBar(nodes, bar.key)
    if (!current) return
    moveBoxes(
      nodes,
      computeGapLayout(
        current.grid,
        current.bar.axis,
        current.bar.gutter,
        shiftFor(current.bar, Math.round(current.bar.gap) + step)
      ),
      { captureUndo: false }
    )
    hasUncommittedNudges = true
  }

  tryOnScopeDispose(() => {
    cancel()
    commitNudges()
  })

  return {
    drag: readonly(drag),
    start,
    preview,
    commit,
    cancel,
    nudge,
    commitNudges
  }
}
