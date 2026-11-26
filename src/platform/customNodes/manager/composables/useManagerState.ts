import { computed, readonly, watch } from 'vue'

import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useToast } from '@/components/ui/toast/toastStore'
import { api } from '@/scripts/api'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

export enum ManagerUIState {
  DISABLED = 'disabled',
  LEGACY_UI = 'legacy',
  NEW_UI = 'new',
  INCOMPATIBLE = 'incompatible'
}

/**
 * Module-level flag to ensure the INCOMPATIBLE upgrade toast fires exactly
 * once per app session, even when useManagerState() is invoked from many
 * components. Without this, every consumer would register its own watcher
 * and stack duplicate toasts on the first transition.
 */
let incompatibleToastShown = false

/**
 * Shows the Manager upgrade toast. Guarded to once per session unless
 * `force` is set, which explicit user actions use to re-surface guidance.
 */
export const showIncompatibleManagerToast = ({ force = false } = {}): void => {
  if (incompatibleToastShown && !force) return
  incompatibleToastShown = true
  useToast().warning(t('manager.incompatibleVersion.title'), {
    description: t('manager.incompatibleVersion.message'),
    duration: 15000
  })
}

export function getManagerUIState(): ManagerUIState {
  const systemStatsStore = useSystemStatsStore()
  if (!systemStatsStore.isInitialized) {
    return ManagerUIState.DISABLED
  }

  const clientSupportsV4 =
    api.getClientFeatureFlags().supports_manager_v4_ui === true
  const serverSupportsV4 = api.getServerFeature('extension.manager.supports_v4')
  const supportsCsrfPost = api.getServerFeature(
    'extension.manager.supports_csrf_post'
  )
  const hasEnableManager =
    systemStatsStore.systemStats?.system.argv.includes('--enable-manager')

  if (!hasEnableManager) {
    return ManagerUIState.DISABLED
  }

  if (
    systemStatsStore.systemStats?.system.argv.includes(
      '--enable-manager-legacy-ui'
    )
  ) {
    return ManagerUIState.LEGACY_UI
  }

  if (serverSupportsV4 === true && supportsCsrfPost !== true) {
    return ManagerUIState.INCOMPATIBLE
  }

  if (clientSupportsV4 && serverSupportsV4 === true) {
    return ManagerUIState.NEW_UI
  }

  if (serverSupportsV4 === true && !clientSupportsV4) {
    return ManagerUIState.LEGACY_UI
  }

  if (serverSupportsV4 === false) {
    return ManagerUIState.LEGACY_UI
  }

  if (serverSupportsV4 === undefined) {
    return ManagerUIState.NEW_UI
  }

  return ManagerUIState.DISABLED
}

export function useManagerState() {
  const managerUIState = readonly(computed(getManagerUIState))

  const isManagerEnabled = readonly(
    computed((): boolean => {
      return (
        managerUIState.value !== ManagerUIState.DISABLED &&
        managerUIState.value !== ManagerUIState.INCOMPATIBLE
      )
    })
  )

  const isNewManagerUI = readonly(
    computed((): boolean => {
      return managerUIState.value === ManagerUIState.NEW_UI
    })
  )

  const isLegacyManagerUI = readonly(
    computed((): boolean => {
      return managerUIState.value === ManagerUIState.LEGACY_UI
    })
  )

  const isIncompatibleManager = readonly(
    computed((): boolean => {
      return managerUIState.value === ManagerUIState.INCOMPATIBLE
    })
  )

  const shouldShowInstallButton = readonly(
    computed((): boolean => {
      return isNewManagerUI.value
    })
  )

  const shouldShowManagerButtons = readonly(
    computed((): boolean => {
      return isManagerEnabled.value
    })
  )

  const shouldShowExtensionsButton = readonly(
    computed((): boolean => isCloud || shouldShowManagerButtons.value)
  )

  watch(
    managerUIState,
    (state) => {
      if (state === ManagerUIState.INCOMPATIBLE) {
        showIncompatibleManagerToast()
      }
    },
    { immediate: true }
  )

  return {
    managerUIState,
    isManagerEnabled,
    isNewManagerUI,
    isLegacyManagerUI,
    isIncompatibleManager,
    shouldShowInstallButton,
    shouldShowManagerButtons,
    shouldShowExtensionsButton
  }
}

// Test-only export: resets the once-per-session toast guard so unit tests
// can assert toast firing across multiple `useManagerState()` invocations.
export const __resetIncompatibleToastGuard = (): void => {
  incompatibleToastShown = false
}
