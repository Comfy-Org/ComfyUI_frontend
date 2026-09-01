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
const MINIMAP_SETTING = 'Comfy.Minimap.Visible'
const NODE_SELECTION_CLASS = 'node-selection-active'

export const useAgentNodeSelectionStore = defineStore(
  'agentNodeSelection',
  () => {
    const canvasStore = useCanvasStore()
    const dialogStore = useDialogStore()
    const settingStore = useSettingStore()
    const sidebarTabStore = useSidebarTabStore()
    const isActive = ref(false)
    const isActionBarsHidden = ref(false)
    const isBannerVisible = ref(false)
    const isLoadingWorkflow = ref(false)
    const restoredNodeIds = ref<string[] | null>(null)
    const nodeIdsByWorkflow = ref<Record<string, string[]>>({})
    let restoreAllowDragNodes: boolean | undefined
    let restoreMultiSelect: boolean | undefined
    let restoreSelectOnly: boolean | undefined
    let restoreMinimap = false
    let restoreSidebarTabId: string | null = null
    let sidebarTimeoutId: ReturnType<typeof setTimeout> | undefined
    let transitionTimeoutId: ReturnType<typeof setTimeout> | undefined

    watch(isActive, (active) => {
      clearTimeout(sidebarTimeoutId)
      clearTimeout(transitionTimeoutId)
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

        restoreMinimap = settingStore.get(MINIMAP_SETTING)
        if (restoreMinimap) void settingStore.set(MINIMAP_SETTING, false)
        return
      }

      isBannerVisible.value = false
      transitionTimeoutId = setTimeout(() => {
        isActionBarsHidden.value = false
      }, BANNER_TRANSITION_MS)

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
      if (isActive.value) return
      const canvas = canvasStore.canvas
      if (canvas) {
        restoreAllowDragNodes = canvas.allow_dragnodes
        restoreMultiSelect = canvas.multi_select
        restoreSelectOnly = canvas.selectOnly
        canvas.allow_dragnodes = false
        canvas.multi_select = true
        canvas.selectOnly = true
        canvas.fitViewToSelectionAnimated({ duration: 300 })
        canvas.canvas.focus()
      }
      isActive.value = true
    }

    function exit(): void {
      if (!isActive.value) return
      isActive.value = false
      const canvas = canvasStore.canvas
      if (!canvas) return
      canvas.allow_dragnodes = restoreAllowDragNodes ?? true
      canvas.multi_select = restoreMultiSelect ?? false
      canvas.selectOnly = restoreSelectOnly ?? false
      restoreAllowDragNodes = undefined
      restoreMultiSelect = undefined
      restoreSelectOnly = undefined
      if (!canvas.selectedItems.size) return
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
