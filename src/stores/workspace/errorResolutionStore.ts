import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { getWorkflowMode, isAppModeValue } from '@/utils/appMode'

/**
 * Store for the focused error-resolution view entered from App Mode.
 * While active, UI chrome is hidden (like focus mode) and a floating
 * error panel with a "Back to App Mode" affordance is shown.
 */
export const useErrorResolutionStore = defineStore('errorResolution', () => {
  const workflowStore = useWorkflowStore()

  const isActive = ref(false)

  function enter() {
    isActive.value = true
  }

  function exit() {
    isActive.value = false
  }

  // The view is global state while the underlying mode (workflow.activeMode)
  // is per-workflow, so leaving the workflow must end the view.
  watch(
    () => workflowStore.activeWorkflow?.key,
    () => {
      if (isActive.value) exit()
    }
  )

  // Returning to app mode by any path (including the Toggle App Mode
  // command while chrome is hidden) must also end the view.
  watch(
    () => isAppModeValue(getWorkflowMode(workflowStore.activeWorkflow)),
    (inAppMode) => {
      if (inAppMode && isActive.value) exit()
    }
  )

  return { isActive, enter, exit }
})
