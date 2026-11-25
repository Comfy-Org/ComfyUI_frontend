import { tryOnScopeDispose } from '@vueuse/core'
import { readonly, shallowRef, watch } from 'vue'

import {
  computeGapBars,
  computeGapLayout,
  detectSelectionGrid,
  minimumBarGap
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type {
  BoxPosition,
  GapBar,
  SelectionGrid
} from '@/components/graph/selectionGrid/selectionGridLayout'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

interface GapDrag {
  gap: number
  bar: GapBar
  grid: SelectionGrid
  nodes: LGraphNode[]
  restore: (action?: 'commit' | 'rollback') => void
  finish: () => void
  previewed: boolean
}

function layoutAtGap(
  grid: SelectionGrid,
  bar: GapBar,
  gap: number
): BoxPosition[] {
  return computeGapLayout(grid, bar.axis, bar.boundary, gap - bar.gap)
}

export function useGapDragSession(onNudgesSettled?: () => void) {
  const { gridNodes, measure, capturePositions, moveBoxes, recordUndoStep } =
    useSelectionGrid()
  const canvasStore = useCanvasStore()
  const workflowStore = useWorkflowStore()

  const drag = shallowRef<GapDrag | null>(null)
  let pendingFrame: number | null = null
  let finishNudges: (() => void) | undefined

  function currentBar(nodes: LGraphNode[], key: string) {
    const grid = detectSelectionGrid(measure(nodes))
    const bar = computeGapBars(grid).find((candidate) => candidate.key === key)
    return bar && { bar, grid }
  }

  const cancelPendingFrame = () => {
    if (pendingFrame === null) return
    cancelAnimationFrame(pendingFrame)
    pendingFrame = null
  }

  const end = (action: 'commit' | 'rollback') => {
    cancelPendingFrame()
    const current = drag.value
    drag.value = null
    if (!current) return
    current.restore(current.previewed ? action : 'commit')
    current.finish()
  }

  const cancel = () => end('rollback')

  const commitNudges = (): boolean => {
    if (!finishNudges) return false
    const finish = finishNudges
    finishNudges = undefined
    finish()
    onNudgesSettled?.()
    return true
  }

  const start = (bar: GapBar) => {
    cancel()
    commitNudges()
    if (canvasStore.isReadOnly) return
    const nodes = [...gridNodes.value]
    const current = currentBar(nodes, bar.key)
    if (!current) return
    drag.value = {
      gap: Math.round(current.bar.gap),
      bar: current.bar,
      grid: current.grid,
      nodes,
      restore: capturePositions(nodes),
      finish:
        workflowStore.activeWorkflow?.changeTracker.beginPreview(cancel) ??
        recordUndoStep,
      previewed: false
    }
  }

  const preview = (delta: number) => {
    const current = drag.value
    if (!current || !Number.isFinite(delta)) return
    const gap = Math.max(
      minimumBarGap(current.bar),
      Math.round(current.bar.gap) + Math.round(delta)
    )
    if (gap === current.gap) return
    const updated = { ...current, gap }
    drag.value = updated
    cancelPendingFrame()
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null
      const moved = moveBoxes(
        current.nodes,
        layoutAtGap(current.grid, current.bar, gap),
        {
          captureUndo: false
        }
      )
      if (moved) updated.previewed = true
    })
  }

  const commit = () => {
    const current = drag.value
    if (!current || current.gap === Math.round(current.bar.gap)) {
      cancel()
      return
    }
    cancelPendingFrame()
    const moved = moveBoxes(
      current.nodes,
      layoutAtGap(current.grid, current.bar, current.gap),
      {
        captureUndo: false
      }
    )
    if (moved) end('commit')
    else cancel()
  }

  const nudge = (bar: GapBar, step: number) => {
    if (drag.value || canvasStore.isReadOnly || !Number.isFinite(step)) return
    const nodes = [...gridNodes.value]
    const current = currentBar(nodes, bar.key)
    if (!current) return
    const shownGap = Math.round(current.bar.gap)
    const gap = Math.max(minimumBarGap(current.bar), shownGap + step)
    if (gap === shownGap) return
    if (!finishNudges) {
      const restore = capturePositions(nodes)
      const finish =
        workflowStore.activeWorkflow?.changeTracker.beginPreview(
          commitNudges,
          () => {
            restore()
            commitNudges()
          }
        ) ?? recordUndoStep
      finishNudges = () => {
        restore('commit')
        finish()
      }
    }
    const moved = moveBoxes(
      nodes,
      layoutAtGap(current.grid, current.bar, gap),
      {
        captureUndo: false
      }
    )
    if (!moved) commitNudges()
  }

  const leaveGraph = () => {
    cancel()
    commitNudges()
  }

  watch(() => canvasStore.currentGraph, leaveGraph, { flush: 'sync' })

  tryOnScopeDispose(leaveGraph)

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
