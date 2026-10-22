import { createSharedComposable, useStorage } from '@vueuse/core'
import { computed } from 'vue'

import { useConflictDetectionStore } from '@/workbench/extensions/manager/stores/conflictDetectionStore'

/**
 * LocalStorage keys for conflict acknowledgment tracking
 */
const STORAGE_KEYS = {
  CONFLICT_MODAL_DISMISSED: 'Comfy.ConflictModalDismissed',
  CONFLICT_RED_DOT_DISMISSED: 'Comfy.ConflictRedDotDismissed',
  CONFLICT_WARNING_BANNER_DISMISSED: 'Comfy.ConflictWarningBannerDismissed'
} as const

/**
 * Interface for conflict acknowledgment state
 */
export interface ConflictAcknowledgmentState {
  modal_dismissed: boolean
  red_dot_dismissed: boolean
  warning_banner_dismissed: boolean
}

const useAcknowledgmentStorage = createSharedComposable(() => ({
  modalDismissed: useStorage(STORAGE_KEYS.CONFLICT_MODAL_DISMISSED, false),
  redDotDismissed: useStorage(STORAGE_KEYS.CONFLICT_RED_DOT_DISMISSED, false),
  warningBannerDismissed: useStorage(
    STORAGE_KEYS.CONFLICT_WARNING_BANNER_DISMISSED,
    false
  )
}))

/**
 * Tracks conflict acknowledgment state persisted in localStorage.
 */
export function useConflictAcknowledgment() {
  const conflictDetectionStore = useConflictDetectionStore()
  const { modalDismissed, redDotDismissed, warningBannerDismissed } =
    useAcknowledgmentStorage()

  const state = computed<ConflictAcknowledgmentState>(() => ({
    modal_dismissed: modalDismissed.value,
    red_dot_dismissed: redDotDismissed.value,
    warning_banner_dismissed: warningBannerDismissed.value
  }))

  function dismissRedDotNotification(): void {
    redDotDismissed.value = true
  }

  function dismissWarningBanner(): void {
    warningBannerDismissed.value = true
    redDotDismissed.value = true
  }

  function markConflictsAsSeen(): void {
    redDotDismissed.value = true
    modalDismissed.value = true
    warningBannerDismissed.value = true
  }

  const hasConflicts = computed(() => conflictDetectionStore.hasConflicts)
  const shouldShowConflictModal = computed(() => !modalDismissed.value)
  const shouldShowRedDot = computed(() => {
    if (!hasConflicts.value) return false
    if (redDotDismissed.value) return false
    return true
  })
  const shouldShowManagerBanner = computed(() => {
    return hasConflicts.value && !warningBannerDismissed.value
  })

  return {
    acknowledgmentState: state,
    shouldShowConflictModal,
    shouldShowRedDot,
    shouldShowManagerBanner,
    dismissRedDotNotification,
    dismissWarningBanner,
    markConflictsAsSeen
  }
}
