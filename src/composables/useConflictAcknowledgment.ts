import { computed, ref } from 'vue'

/**
 * LocalStorage keys for conflict acknowledgment tracking
 */
const STORAGE_KEYS = {
  CONFLICT_MODAL_DISMISSED: 'comfyui.conflict.modal.dismissed',
  CONFLICT_RED_DOT_DISMISSED: 'comfyui.conflict.red_dot.dismissed',
  ACKNOWLEDGED_CONFLICTS: 'comfyui.conflict.acknowledged',
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
  // Reactive state
  const state = ref<ConflictAcknowledgmentState>(loadAcknowledgmentState())

  /**
   * Load acknowledgment state from localStorage
   */
  function loadAcknowledgmentState(): ConflictAcknowledgmentState {
    try {
      const modalDismissed =
        localStorage.getItem(STORAGE_KEYS.CONFLICT_MODAL_DISMISSED) === 'true'
      const redDotDismissed =
        localStorage.getItem(STORAGE_KEYS.CONFLICT_RED_DOT_DISMISSED) === 'true'
      const acknowledgedConflictsData = localStorage.getItem(
        STORAGE_KEYS.ACKNOWLEDGED_CONFLICTS
      )
      const lastComfyUIVersion =
        localStorage.getItem(STORAGE_KEYS.LAST_COMFYUI_VERSION) || ''

      let acknowledgedConflicts: AcknowledgedConflict[] = []
      if (acknowledgedConflictsData) {
        acknowledgedConflicts = JSON.parse(acknowledgedConflictsData)
      }

      return {
        modal_dismissed: modalDismissed,
        red_dot_dismissed: redDotDismissed,
        acknowledged_conflicts: acknowledgedConflicts,
        last_comfyui_version: lastComfyUIVersion
      }
    } catch (error) {
      console.warn(
        '[ConflictAcknowledgment] Failed to load acknowledgment state from localStorage:',
        error
      )
      return {
        modal_dismissed: false,
        red_dot_dismissed: false,
        acknowledged_conflicts: [],
        last_comfyui_version: ''
      }
    }
  }

  /**
   * Save acknowledgment state to localStorage
   */
  function saveAcknowledgmentState(): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.CONFLICT_MODAL_DISMISSED,
        String(state.value.modal_dismissed)
      )
      localStorage.setItem(
        STORAGE_KEYS.CONFLICT_RED_DOT_DISMISSED,
        String(state.value.red_dot_dismissed)
      )
      localStorage.setItem(
        STORAGE_KEYS.ACKNOWLEDGED_CONFLICTS,
        JSON.stringify(state.value.acknowledged_conflicts)
      )
      localStorage.setItem(
        STORAGE_KEYS.LAST_COMFYUI_VERSION,
        state.value.last_comfyui_version
      )
    } catch (error) {
      console.warn(
        '[ConflictAcknowledgment] Failed to save acknowledgment state to localStorage:',
        error
      )
    }
  }

  /**
   * Check if ComfyUI version has changed since last run
   * If version changed, reset acknowledgment state
   */
  function checkComfyUIVersionChange(currentVersion: string): boolean {
    const lastVersion = state.value.last_comfyui_version
    const versionChanged = lastVersion !== '' && lastVersion !== currentVersion

    if (versionChanged) {
      console.log(
        `[ConflictAcknowledgment] ComfyUI version changed from ${lastVersion} to ${currentVersion}, resetting acknowledgment state`
      )
      resetAcknowledgmentState()
    }

    // Update last known version
    state.value.last_comfyui_version = currentVersion
    saveAcknowledgmentState()

    return versionChanged
  }

  /**
   * Reset all acknowledgment state (called when ComfyUI version changes)
   */
  function resetAcknowledgmentState(): void {
    state.value.modal_dismissed = false
    state.value.red_dot_dismissed = false
    state.value.acknowledged_conflicts = []
    saveAcknowledgmentState()
  }

  /**
   * Mark conflict modal as dismissed
   */
  function dismissConflictModal(): void {
    state.value.modal_dismissed = true
    saveAcknowledgmentState()
    console.log('[ConflictAcknowledgment] Conflict modal dismissed')
  }

  /**
   * Mark red dot notification as dismissed
   */
  function dismissRedDotNotification(): void {
    state.value.red_dot_dismissed = true
    saveAcknowledgmentState()
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
    state.value.acknowledged_conflicts =
      state.value.acknowledged_conflicts.filter(
        (ack) =>
          !(ack.package_id === packageId && ack.conflict_type === conflictType)
      )

    // Add new acknowledgment
    state.value.acknowledged_conflicts.push(acknowledgment)
    saveAcknowledgmentState()

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
    return state.value.acknowledged_conflicts.some(
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
    state.value.acknowledged_conflicts =
      state.value.acknowledged_conflicts.filter(
        (ack) =>
          !(ack.package_id === packageId && ack.conflict_type === conflictType)
      )
    saveAcknowledgmentState()
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
  const shouldShowConflictModal = computed(() => !state.value.modal_dismissed)
  const shouldShowRedDot = computed(() => !state.value.red_dot_dismissed)

  /**
   * Get all acknowledged package IDs
   */
  const acknowledgedPackageIds = computed(() => {
    return Array.from(
      new Set(state.value.acknowledged_conflicts.map((ack) => ack.package_id))
    )
  })

  /**
   * Get acknowledgment statistics
   */
  const acknowledgmentStats = computed(() => {
    return {
      total_acknowledged: state.value.acknowledged_conflicts.length,
      unique_packages: acknowledgedPackageIds.value.length,
      modal_dismissed: state.value.modal_dismissed,
      red_dot_dismissed: state.value.red_dot_dismissed,
      last_comfyui_version: state.value.last_comfyui_version
    }
  })

  return {
    // State
    acknowledgmentState: computed(() => state.value),
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
