import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

/**
 * LocalStorage keys for conflict acknowledgment tracking
 */
const STORAGE_KEYS = {
  CONFLICT_MODAL_DISMISSED: 'comfy_manager_conflict_banner_dismissed',
  CONFLICT_RED_DOT_DISMISSED: 'comfy_help_center_conflict_seen',
  ACKNOWLEDGED_CONFLICTS: 'comfy_conflict_acknowledged',
  LAST_COMFYUI_VERSION: 'comfyui.last_version'
} as const

/**
 * Interface for tracking individual conflict acknowledgments
 */
interface AcknowledgedConflict {
  package_id: string
  conflict_type: string
  timestamp: string
  comfyui_version: string
}

/**
 * Interface for conflict acknowledgment state
 */
interface ConflictAcknowledgmentState {
  modal_dismissed: boolean
  red_dot_dismissed: boolean
  acknowledged_conflicts: AcknowledgedConflict[]
  last_comfyui_version: string
}

/**
 * Composable for managing conflict acknowledgment state in localStorage
 *
 * This handles:
 * - Tracking whether conflict modal has been dismissed
 * - Tracking whether red dot notification has been cleared
 * - Managing per-package conflict acknowledgments
 * - Detecting ComfyUI version changes to reset acknowledgment state
 */
export function useConflictAcknowledgment() {
  // Reactive state using VueUse's useStorage for automatic persistence
  const modalDismissed = useStorage(
    STORAGE_KEYS.CONFLICT_MODAL_DISMISSED,
    false
  )
  const redDotDismissed = useStorage(
    STORAGE_KEYS.CONFLICT_RED_DOT_DISMISSED,
    false
  )
  const acknowledgedConflicts = useStorage<AcknowledgedConflict[]>(
    STORAGE_KEYS.ACKNOWLEDGED_CONFLICTS,
    []
  )
  const lastComfyUIVersion = useStorage(STORAGE_KEYS.LAST_COMFYUI_VERSION, '')

  // Create computed state object for backward compatibility
  const state = computed<ConflictAcknowledgmentState>(() => ({
    modal_dismissed: modalDismissed.value,
    red_dot_dismissed: redDotDismissed.value,
    acknowledged_conflicts: acknowledgedConflicts.value,
    last_comfyui_version: lastComfyUIVersion.value
  }))

  /**
   * Check if ComfyUI version has changed since last run
   * If version changed, reset acknowledgment state
   */
  function checkComfyUIVersionChange(currentVersion: string): boolean {
    const lastVersion = lastComfyUIVersion.value
    const versionChanged = lastVersion !== '' && lastVersion !== currentVersion

    if (versionChanged) {
      console.log(
        `[ConflictAcknowledgment] ComfyUI version changed from ${lastVersion} to ${currentVersion}, resetting acknowledgment state`
      )
      resetAcknowledgmentState()
    }

    // Update last known version
    lastComfyUIVersion.value = currentVersion

    return versionChanged
  }

  /**
   * Reset all acknowledgment state (called when ComfyUI version changes)
   */
  function resetAcknowledgmentState(): void {
    modalDismissed.value = false
    redDotDismissed.value = false
    acknowledgedConflicts.value = []
  }

  /**
   * Mark conflict modal as dismissed
   */
  function dismissConflictModal(): void {
    modalDismissed.value = true
    console.log('[ConflictAcknowledgment] Conflict modal dismissed')
  }

  /**
   * Mark red dot notification as dismissed
   */
  function dismissRedDotNotification(): void {
    redDotDismissed.value = true
    console.log('[ConflictAcknowledgment] Red dot notification dismissed')
  }

  /**
   * Acknowledge a specific conflict for a package
   */
  function acknowledgeConflict(
    packageId: string,
    conflictType: string,
    comfyuiVersion: string
  ): void {
    const acknowledgment: AcknowledgedConflict = {
      package_id: packageId,
      conflict_type: conflictType,
      timestamp: new Date().toISOString(),
      comfyui_version: comfyuiVersion
    }

    // Remove any existing acknowledgment for the same package and conflict type
    acknowledgedConflicts.value = acknowledgedConflicts.value.filter(
      (ack) =>
        !(ack.package_id === packageId && ack.conflict_type === conflictType)
    )

    // Add new acknowledgment
    acknowledgedConflicts.value.push(acknowledgment)

    console.log(
      `[ConflictAcknowledgment] Acknowledged conflict for ${packageId}:${conflictType}`
    )
  }

  /**
   * Check if a specific conflict has been acknowledged
   */
  function isConflictAcknowledged(
    packageId: string,
    conflictType: string
  ): boolean {
    return acknowledgedConflicts.value.some(
      (ack) =>
        ack.package_id === packageId && ack.conflict_type === conflictType
    )
  }

  /**
   * Remove acknowledgment for a specific conflict
   */
  function removeConflictAcknowledgment(
    packageId: string,
    conflictType: string
  ): void {
    acknowledgedConflicts.value = acknowledgedConflicts.value.filter(
      (ack) =>
        !(ack.package_id === packageId && ack.conflict_type === conflictType)
    )
    console.log(
      `[ConflictAcknowledgment] Removed acknowledgment for ${packageId}:${conflictType}`
    )
  }

  /**
   * Clear all acknowledgments (for debugging/admin purposes)
   */
  function clearAllAcknowledgments(): void {
    resetAcknowledgmentState()
    console.log('[ConflictAcknowledgment] Cleared all acknowledgments')
  }

  // Computed properties
  const shouldShowConflictModal = computed(() => !modalDismissed.value)
  const shouldShowRedDot = computed(() => !redDotDismissed.value)

  /**
   * Get all acknowledged package IDs
   */
  const acknowledgedPackageIds = computed(() => {
    return Array.from(
      new Set(acknowledgedConflicts.value.map((ack) => ack.package_id))
    )
  })

  /**
   * Get acknowledgment statistics
   */
  const acknowledgmentStats = computed(() => {
    return {
      total_acknowledged: acknowledgedConflicts.value.length,
      unique_packages: acknowledgedPackageIds.value.length,
      modal_dismissed: modalDismissed.value,
      red_dot_dismissed: redDotDismissed.value,
      last_comfyui_version: lastComfyUIVersion.value
    }
  })

  return {
    // State
    acknowledgmentState: state,
    shouldShowConflictModal,
    shouldShowRedDot,
    acknowledgedPackageIds,
    acknowledgmentStats,

    // Methods
    checkComfyUIVersionChange,
    dismissConflictModal,
    dismissRedDotNotification,
    acknowledgeConflict,
    isConflictAcknowledged,
    removeConflictAcknowledgment,
    clearAllAcknowledgments,
    resetAcknowledgmentState
  }
}
