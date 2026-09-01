import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { visibleCanvasViewport } from '@/composables/canvas/visibleCanvasViewport'
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

/* Graph units around the framed nodes so none sit flush with the edge. */
const FRAME_PADDING = 40

/**
 * Bounds are taken from `pos`/`size`, the geometry litegraph maintains for
 * canvas and Vue nodes alike (`boundingRect` is a renderer cache that stays
 * zeroed under Vue nodes). Structural rather than class-based so selected
 * groups frame the same way selected nodes do.
 */
interface FramableItem {
  pos?: ArrayLike<number>
  size?: ArrayLike<number>
}

function frameBounds(
  items: readonly FramableItem[]
): [number, number, number, number] | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const item of items) {
    if (!item.pos || !item.size) continue
    minX = Math.min(minX, item.pos[0])
    minY = Math.min(minY, item.pos[1])
    maxX = Math.max(maxX, item.pos[0] + item.size[0])
    maxY = Math.max(maxY, item.pos[1] + item.size[1])
  }
  if (minX === Infinity) return null
  return [
    minX - FRAME_PADDING,
    minY - FRAME_PADDING,
    maxX - minX + FRAME_PADDING * 2,
    maxY - minY + FRAME_PADDING * 2
  ]
}

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
      frameForPicking()
    }

    /**
     * Every entry path frames the pick surface: the minimap is off during the
     * mode, so a node outside the view would have to be found by blind
     * panning. Items selected before entry take priority; otherwise the whole
     * graph is framed. The viewport excludes the docked agent panel so the
     * frame lands in the visible area.
     */
    function frameForPicking(): void {
      const canvas = canvasStore.canvas
      if (!canvas) return
      const selected = [...canvas.selectedItems]
      const bounds = frameBounds(
        selected.length ? selected : (canvas.graph?.nodes ?? [])
      )
      if (!bounds) return
      canvas.animateToBounds(bounds, {
        viewport: visibleCanvasViewport(canvas)
      })
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
