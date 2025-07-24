import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

import { useConflictDetectionStore } from '@/stores/conflictDetectionStore'

/**
 * Composable for managing conflict banner state across components
 * Provides centralized logic for conflict visibility and dismissal
 */
export function useConflictBannerState() {
  const conflictDetectionStore = useConflictDetectionStore()

  // Storage keys
  const HELP_CENTER_CONFLICT_SEEN_KEY = 'comfy_help_center_conflict_seen'
  const MANAGER_CONFLICT_BANNER_DISMISSED_KEY =
    'comfy_manager_conflict_banner_dismissed'

  // Reactive storage state
  const hasSeenConflicts = useStorage(HELP_CENTER_CONFLICT_SEEN_KEY, false)
  const isConflictBannerDismissed = useStorage(
    MANAGER_CONFLICT_BANNER_DISMISSED_KEY,
    false
  )

  // Computed states
  const hasConflicts = computed(() => conflictDetectionStore.hasConflicts)

  /**
   * Check if the help center should show a red dot for conflicts
   */
  const shouldShowConflictRedDot = computed(() => {
    if (!hasConflicts.value) return false
    return !hasSeenConflicts.value
  })

  /**
   * Check if the manager conflict banner should be visible
   */
  const shouldShowManagerBanner = computed(() => {
    return hasConflicts.value && !isConflictBannerDismissed.value
  })

  /**
   * Mark conflicts as seen (used when user opens manager dialog or help center)
   */
  const markConflictsAsSeen = () => {
    if (hasConflicts.value) {
      hasSeenConflicts.value = true
      isConflictBannerDismissed.value = true
      
      // Force localStorage update as backup due to useStorage sync timing issue
      // useStorage updates localStorage asynchronously, but we need immediate persistence
      localStorage.setItem(HELP_CENTER_CONFLICT_SEEN_KEY, 'true')
      localStorage.setItem(MANAGER_CONFLICT_BANNER_DISMISSED_KEY, 'true')
    }
  }

  return {
    // State
    hasConflicts,
    hasSeenConflicts,
    isConflictBannerDismissed,

    // Computed
    shouldShowConflictRedDot,
    shouldShowManagerBanner,

    // Actions
    markConflictsAsSeen
  }
}
