import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const ACTION_BARS_TRANSITION_MS = 300
const BANNER_TRANSITION_MS = 150
const SIDEBAR_PANEL_TRANSITION_MS = 200

/**
 * Hides the whole toast layer for the duration of the mode. PrimeVue teleports
 * every `<Toast>` container to `<body>`, and several components mount their own
 * groups, so the layer can only be reached from the root - see the `.p-toast`
 * rule in `src/assets/css/style.css`. The mode owns the class rather than any
 * one toast component, since no single component renders all of those groups.
 */
const NODE_SELECTION_CLASS = 'node-selection-active'

const MINIMAP_SETTING = 'Comfy.Minimap.Visible'
export const useAgentNodeSelectionStore = defineStore(
  'agentNodeSelection',
  () => {
    const dialogStore = useDialogStore()
    const sidebarTabStore = useSidebarTabStore()
    const canvasStore = useCanvasStore()
    const settingStore = useSettingStore()
    const isActive = ref(false)
    const isActionBarsHidden = ref(false)
    const isBannerVisible = ref(false)
    const isLoadingWorkflow = ref(false)
    const restoredNodeIds = ref<string[] | null>(null)
    const nodeIdsByWorkflow = ref<Record<string, string[]>>({})
    let transitionTimeoutId: ReturnType<typeof setTimeout> | undefined
    let sidebarTimeoutId: ReturnType<typeof setTimeout> | undefined
    let restoreSidebarTabId: string | null = null
    let restoreMinimap = false

    watch(isActive, (active) => {
      clearTimeout(transitionTimeoutId)
      clearTimeout(sidebarTimeoutId)

      // This watcher is created with the store, so it runs before any watcher a
      // component registers on `isActive`. That is what lets GlobalToast replay
      // its deferred messages onto an already-visible layer.
      document.body.classList.toggle(NODE_SELECTION_CLASS, active)

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

        // Flipping the user's own setting rather than overriding the minimap
        // leaves the normal toggle working: anyone who wants the map back while
        // picking can just switch it on, and only what we turned off is
        // restored on exit.
        restoreMinimap = settingStore.get(MINIMAP_SETTING)
        if (restoreMinimap) void settingStore.set(MINIMAP_SETTING, false)
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

      if (restoreMinimap) {
        restoreMinimap = false
        void settingStore.set(MINIMAP_SETTING, true)
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
