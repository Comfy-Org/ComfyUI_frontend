import { tryOnScopeDispose } from '@vueuse/core'
import { readonly, ref } from 'vue'

import {
  DEFAULT_TIDY_GAP,
  detectSelectionGrid,
  tidiedGapOf
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type {
  GapBar,
  SelectionGrid
} from '@/components/graph/selectionGrid/selectionGridLayout'
import { useGapDragSession } from '@/components/graph/selectionGrid/useGapDragSession'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

export function useTidySession() {
  const { gridNodes, measure, tidyUp, recordUndoStep, capturePositions } =
    useSelectionGrid()
  const workflowStore = useWorkflowStore()
  const handles = useGapDragSession(showLaidOutGap)

  const gap = ref(DEFAULT_TIDY_GAP)
  const hasMixedGaps = ref(false)
  let nodes: LGraphNode[] = []
  let preview:
    | {
        grid: SelectionGrid
        release: () => void
        frame?: number
      }
    | undefined

  function dropPendingPreview() {
    if (preview?.frame === undefined) return
    cancelAnimationFrame(preview.frame)
    preview.frame = undefined
  }

  function applyGap(nextGap: number) {
    tidyUp(nodes, { gap: nextGap, captureUndo: false, grid: preview?.grid })
  }

  function start() {
    finish()
    hasMixedGaps.value = false
    nodes = [...gridNodes.value]
    gap.value = tidyUp(nodes)
  }

  function previewGap(nextGap: number) {
    if (handles.drag.value) return
    if (!preview) {
      const grid = detectSelectionGrid(measure(nodes))
      const restore = capturePositions(nodes)
      const previousGap = gap.value
      const previousMixed = hasMixedGaps.value
      const finishCapture =
        workflowStore.activeWorkflow?.changeTracker.beginPreview(finish, () => {
          dropPendingPreview()
          restore()
          gap.value = previousGap
          hasMixedGaps.value = previousMixed
          releasePreview()
        }) ?? recordUndoStep
      preview = {
        grid,
        release() {
          restore('commit')
          finishCapture()
        }
      }
    }
    hasMixedGaps.value = false
    gap.value = nextGap
    dropPendingPreview()
    const active = preview
    active.frame = requestAnimationFrame(() => {
      active.frame = undefined
      applyGap(nextGap)
    })
  }

  function releasePreview() {
    const release = preview?.release ?? recordUndoStep
    preview = undefined
    release()
  }

  function commitGap(nextGap: number) {
    if (handles.drag.value) return
    hasMixedGaps.value = false
    dropPendingPreview()
    gap.value = nextGap
    applyGap(nextGap)
    releasePreview()
  }

  function showLaidOutGap() {
    const laidOutGap = tidiedGapOf(measure())
    hasMixedGaps.value = laidOutGap === undefined
    if (laidOutGap !== undefined) gap.value = laidOutGap
  }

  function finish() {
    if (preview) commitGap(gap.value)
  }

  tryOnScopeDispose(finish)

  return {
    gap: readonly(gap),
    hasMixedGaps: readonly(hasMixedGaps),
    start,
    previewGap,
    commitGap,
    finish,
    handles: {
      ...handles,
      start(bar: GapBar) {
        finish()
        handles.start(bar)
      },
      commit() {
        handles.commit()
        showLaidOutGap()
      },
      nudge(bar: GapBar, step: number) {
        finish()
        handles.nudge(bar, step)
      }
    }
  }
}
