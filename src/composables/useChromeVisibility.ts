import { computed } from 'vue'

import { useErrorResolutionStore } from '@/stores/workspace/errorResolutionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

/**
 * Whether UI chrome (sidebars, top menu, tabs, bottom panel) is hidden,
 * leaving only the canvas and minimap. True in focus mode and in the
 * error-resolution view.
 */
export function useChromeVisibility() {
  const workspaceStore = useWorkspaceStore()
  const errorResolutionStore = useErrorResolutionStore()

  const isChromeHidden = computed(
    () => workspaceStore.focusMode || errorResolutionStore.isActive
  )

  return { isChromeHidden }
}
