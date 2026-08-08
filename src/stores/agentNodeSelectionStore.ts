import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

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
    const isActive = ref(false)
    const isActionBarsHidden = ref(false)
    const isBannerVisible = ref(false)
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

      if (restoreSidebarTabId) {
        sidebarTabStore.activeSidebarTabId = restoreSidebarTabId
        restoreSidebarTabId = null
      }
    })

    function enter(): void {
      isActive.value = true
    }

    function exit(): void {
      isActive.value = false
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
      enter,
      exit
    }
  }
)
