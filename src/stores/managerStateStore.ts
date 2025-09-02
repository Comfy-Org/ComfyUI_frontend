import { defineStore } from 'pinia'
import { computed, readonly, watchEffect } from 'vue'

import { useExtensionStore } from '@/stores/extensionStore'
import { useFeatureFlagsStore } from '@/stores/featureFlagsStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

export enum ManagerUIState {
  DISABLED = 'disabled',
  LEGACY_UI = 'legacy',
  NEW_UI = 'new'
}

export const useManagerStateStore = defineStore('managerState', () => {
  const systemStatsStore = useSystemStatsStore()
  const extensionStore = useExtensionStore()
  const featureFlagsStore = useFeatureFlagsStore()

  // Reactive computed manager state that updates when dependencies change
  const managerUIState = computed(() => {
    const systemStats = systemStatsStore.systemStats
    const clientSupportsV4 = featureFlagsStore.clientSupportsManagerV4UI
    const hasLegacyManager = extensionStore.extensions.some(
      (ext) => ext.name === 'Comfy.CustomNodesManager'
    )

    const serverSupportsV4 = featureFlagsStore.supportsManagerV4

    // Check command line args first
    if (systemStats?.system?.argv?.includes('--disable-manager')) {
      return ManagerUIState.DISABLED // comfyui_manager package not installed
    }

    if (systemStats?.system?.argv?.includes('--enable-manager-legacy-ui')) {
      return ManagerUIState.LEGACY_UI // forced legacy
    }

    // Both client and server support v4 = NEW_UI
    if (clientSupportsV4 && serverSupportsV4 === true) {
      return ManagerUIState.NEW_UI
    }

    // Server supports v4 but client doesn't = LEGACY_UI
    if (serverSupportsV4 === true) {
      return ManagerUIState.LEGACY_UI
    }

    // If server feature flags haven't loaded yet, return DISABLED for now
    // This will update reactively once feature flags load
    if (!featureFlagsStore.isReady || serverSupportsV4 === undefined) {
      return ManagerUIState.DISABLED
    }

    // Server explicitly doesn't support v4 (false) = assume legacy manager exists
    // OR legacy manager extension is detected
    if (serverSupportsV4 === false || hasLegacyManager) {
      return ManagerUIState.LEGACY_UI
    }

    // No manager at all = DISABLED
    return ManagerUIState.DISABLED
  })

  // Debug logging in development mode only
  if (import.meta.env.DEV) {
    watchEffect(() => {
      const systemStats = systemStatsStore.systemStats
      const clientSupportsV4 = featureFlagsStore.clientSupportsManagerV4UI
      const serverSupportsV4 = featureFlagsStore.supportsManagerV4
      const hasLegacyManager = extensionStore.extensions.some(
        (ext) => ext.name === 'Comfy.CustomNodesManager'
      )

      console.log('[Manager State Debug]', {
        currentState: managerUIState.value,
        systemStats: systemStats?.system?.argv,
        clientSupportsV4,
        serverSupportsV4,
        hasLegacyManager,
        isReady: featureFlagsStore.isReady,
        extensions: extensionStore.extensions.map((e) => e.name)
      })
    })
  }

  return {
    managerUIState: readonly(managerUIState)
  }
})
