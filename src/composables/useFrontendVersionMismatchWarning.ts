import { whenever } from '@vueuse/core'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToastStore } from '@/stores/toastStore'
import { useVersionCompatibilityStore } from '@/stores/versionCompatibilityStore'

export interface UseFrontendVersionMismatchWarningOptions {
  immediate?: boolean
}

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

    const detailMessage =
      message.type === 'outdated'
        ? t('g.frontendOutdated', {
            frontendVersion: message.frontendVersion,
            requiredVersion: message.requiredVersion
          })
        : t('g.frontendNewer', {
            frontendVersion: message.frontendVersion,
            backendVersion: message.backendVersion
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
        (shouldShow) => {
          if (shouldShow) {
            showWarning()
          }
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
