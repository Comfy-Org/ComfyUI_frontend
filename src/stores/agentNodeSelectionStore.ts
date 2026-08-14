import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { visibleCanvasViewport } from '@/composables/canvas/visibleCanvasViewport'
import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const ACTION_BARS_TRANSITION_MS = 300
const BANNER_TRANSITION_MS = 150
const SIDEBAR_PANEL_TRANSITION_MS = 200
/** Breathing room around the framed graph, in graph units. */
const FIT_PADDING = 40

/**
 * Bounding box enclosing every node, or null when nothing is positioned yet.
 *
 * Derived from `pos`/`size` rather than litegraph's `boundingRect`: the latter
 * is cached geometry that only the litegraph renderer maintains, so with Vue
 * nodes it stays `[0, 0, 0, 0]` and would frame a degenerate rect at the origin.
 */
function graphBounds(nodes: LGraphNode[]): ReadOnlyRect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const x = node.pos?.[0]
    const y = node.pos?.[1]
    const width = node.size?.[0]
    const height = node.size?.[1]
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    ) {
      continue
    }

    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null

  return [
    minX - FIT_PADDING,
    minY - FIT_PADDING,
    maxX - minX + FIT_PADDING * 2,
    maxY - minY + FIT_PADDING * 2
  ]
}

export const useAgentNodeSelectionStore = defineStore(
  'agentNodeSelection',
  () => {
    const dialogStore = useDialogStore()
    const sidebarTabStore = useSidebarTabStore()
    const canvasStore = useCanvasStore()
    const isActive = ref(false)
    const isActionBarsHidden = ref(false)
    const isBannerVisible = ref(false)
    const isLoadingWorkflow = ref(false)
    const restoredNodeIds = ref<string[] | null>(null)
    const nodeIdsByWorkflow = ref<Record<string, string[]>>({})
    let transitionTimeoutId: ReturnType<typeof setTimeout> | undefined
    let sidebarTimeoutId: ReturnType<typeof setTimeout> | undefined
    let restoreSidebarTabId: string | null = null

    watch(isActive, (active) => {
      clearTimeout(transitionTimeoutId)
      clearTimeout(sidebarTimeoutId)

      if (active) {
        isActionBarsHidden.value = true
        transitionTimeoutId = setTimeout(() => {
          isBannerVisible.value = true
        }, ACTION_BARS_TRANSITION_MS)

        restoreSidebarTabId = sidebarTabStore.activeSidebarTabId
        if (restoreSidebarTabId) {
          sidebarTimeoutId = setTimeout(() => {
            sidebarTabStore.activeSidebarTabId = null
          }, SIDEBAR_PANEL_TRANSITION_MS)
        }
        return
      }

      isBannerVisible.value = false
      transitionTimeoutId = setTimeout(() => {
        isActionBarsHidden.value = false
      }, BANNER_TRANSITION_MS)

      // Staged like the entry side rather than snapping back: the panel
      // reappears with the action bars, once the banner has retracted, so the
      // two never animate over each other.
      if (restoreSidebarTabId) {
        const tabId = restoreSidebarTabId
        restoreSidebarTabId = null
        sidebarTimeoutId = setTimeout(() => {
          sidebarTabStore.activeSidebarTabId = tabId
        }, BANNER_TRANSITION_MS)
      }
    })

    /**
     * Frame the whole graph so nodes that were off screen can be picked without
     * panning first. Framed against the region the agent panel doesn't cover.
     * Lives here rather than at the call site so every way into the mode gets
     * it, not just the composer control.
     */
    function fitGraphToView(): void {
      const canvas = canvasStore.canvas
      if (!canvas) return

      const bounds = graphBounds(canvas.graph?.nodes ?? [])
      if (!bounds) return

      canvas.animateToBounds(bounds, {
        viewport: visibleCanvasViewport(canvas)
      })
    }

    function enter(): void {
      isActive.value = true
      fitGraphToView()
    }

    function exit(): void {
      isActive.value = false
    }

    function saveNodeIds(
      workflowPath: string | undefined,
      ids: string[]
    ): void {
      if (!workflowPath) return
      nodeIdsByWorkflow.value = {
        ...nodeIdsByWorkflow.value,
        [workflowPath]: ids
      }
    }

    function nodeIds(workflowPath: string | undefined): string[] {
      return workflowPath ? (nodeIdsByWorkflow.value[workflowPath] ?? []) : []
    }

    function beginWorkflowLoad(): void {
      isLoadingWorkflow.value = true
    }

    function restoreNodeIds(ids: string[]): void {
      restoredNodeIds.value = ids
    }

    function finishWorkflowLoad(): void {
      restoredNodeIds.value = null
      isLoadingWorkflow.value = false
    }

    useEventListener(window, 'keydown', (event: KeyboardEvent) => {
      if (
        isActive.value &&
        event.key === 'Escape' &&
        dialogStore.dialogStack.length === 0
      ) {
        exit()
      }
    })

    return {
      isActive,
      isActionBarsHidden,
      isBannerVisible,
      isLoadingWorkflow,
      restoredNodeIds,
      enter,
      exit,
      saveNodeIds,
      nodeIds,
      beginWorkflowLoad,
      restoreNodeIds,
      finishWorkflowLoad
    }
  }
)
