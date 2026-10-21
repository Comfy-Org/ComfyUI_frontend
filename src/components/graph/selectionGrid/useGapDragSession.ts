import { tryOnScopeDispose } from '@vueuse/core'
import { readonly, ref, watch } from 'vue'

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
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

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
  const shrinkLimit = Math.min(
    Math.ceil(bar.gap - bar.clearance),
    Math.round(bar.gap)
  )
  return Math.max(shrinkLimit, gap)
}

function layoutAtGap(
  grid: SelectionGrid,
  bar: GapBar,
  gap: number
): BoxPosition[] {
  return computeGapLayout(grid, bar.axis, bar.gutter, gap - bar.gap)
}

export function useGapDragSession() {
  const { gridNodes, measure, placeBoxes, moveBoxes, recordUndoStep } =
    useSelectionGrid()
  const canvasStore = useCanvasStore()

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
    layoutAtGap(origin.grid, origin.bar, gap)

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
    if (canvasStore.isReadOnly) return
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
    cancelPendingFrame()
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null
      const moved = moveBoxes(origin.nodes, layoutFor(origin, gap), {
        captureUndo: false
      })
      if (moved) origin.previewed = true
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
    const moved = moveBoxes(origin.nodes, layoutFor(origin, current.gap), {
      captureUndo: true
    })
    if (moved) end()
    else cancel()
  }

  const nudge = (bar: GapBar, step: number) => {
    if (dragStart || !Number.isFinite(step)) return
    const nodes = [...gridNodes.value]
    const current = currentBar(nodes, bar.key)
    if (!current) return
    const shownGap = Math.round(current.bar.gap)
    const gap = clampBarGap(current.bar, shownGap + step)
    if (gap === shownGap) return
    const moved = moveBoxes(
      nodes,
      layoutAtGap(current.grid, current.bar, gap),
      {
        captureUndo: false
      }
    )
    if (moved) hasUncommittedNudges = true
  }

  const leaveGraph = () => {
    end()
    commitNudges()
  }

  watch(() => canvasStore.currentGraph, leaveGraph)

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
