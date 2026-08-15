import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const ACTION_BARS_TRANSITION_MS = 300
const BANNER_TRANSITION_MS = 150
const SIDEBAR_PANEL_TRANSITION_MS = 200
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

    function enter(): void {
      isActive.value = true
    }

    function exit(): void {
      // Order matters: dropping out of the mode first stops the basket
      // mirroring the canvas, so clearing the selection below leaves the
      // staged chips intact. Picking is finished - the references stay in the
      // composer, but the graph goes back to looking untouched.
      isActive.value = false

      const canvas = canvasStore.canvas
      if (!canvas?.selectedItems.size) return
      canvas.deselectAll()
      canvasStore.updateSelectedItems()
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
