import { whenever } from '@vueuse/core'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToastStore } from '@/stores/toastStore'
import { useVersionCompatibilityStore } from '@/stores/versionCompatibilityStore'

export interface UseFrontendVersionMismatchWarningOptions {
  immediate?: boolean
}

/**
 * Composable for handling frontend version mismatch warnings.
 *
 * Displays toast notifications when the frontend version is incompatible with the backend,
 * either because the frontend is outdated or newer than the backend expects.
 * Automatically dismisses warnings when shown and persists dismissal state for 7 days.
 *
 * @param options - Configuration options
 * @param options.immediate - If true, automatically shows warning when version mismatch is detected
 * @returns Object with methods and computed properties for managing version warnings
 *
 * @example
 * ```ts
 * // Show warning immediately when mismatch detected
 * const { showWarning, shouldShowWarning } = useFrontendVersionMismatchWarning({ immediate: true })
 *
 * // Manual control
 * const { showWarning } = useFrontendVersionMismatchWarning()
 * showWarning() // Call when needed
 * ```
 */
export function useFrontendVersionMismatchWarning(
  options: UseFrontendVersionMismatchWarningOptions = {}
) {
  const { immediate = false } = options
  const { t } = useI18n()
  const toastStore = useToastStore()
  const versionCompatibilityStore = useVersionCompatibilityStore()

  // Track if we've already shown the warning
  let hasShownWarning = false

  const showWarning = () => {
    // Prevent showing the warning multiple times
    if (hasShownWarning) return

    const message = versionCompatibilityStore.warningMessage
    if (!message) return

    const detailMessage = t('g.frontendOutdated', {
      frontendVersion: message.frontendVersion,
      requiredVersion: message.requiredVersion
    })

    const fullMessage = t('g.versionMismatchWarningMessage', {
      warning: t('g.versionMismatchWarning'),
      detail: detailMessage
    })

    toastStore.addAlert(fullMessage)
    hasShownWarning = true

    // Automatically dismiss the warning so it won't show again for 7 days
    versionCompatibilityStore.dismissWarning()
  }

  onMounted(() => {
    // Only set up the watcher if immediate is true
    if (immediate) {
      whenever(
        () => versionCompatibilityStore.shouldShowWarning,
        () => {
          showWarning()
        },
        {
          immediate: true,
          once: true
        }
      )
    }
  })

  return {
    showWarning,
    shouldShowWarning: computed(
      () => versionCompatibilityStore.shouldShowWarning
    ),
    dismissWarning: versionCompatibilityStore.dismissWarning,
    hasVersionMismatch: computed(
      () => versionCompatibilityStore.hasVersionMismatch
    )
  }
}
