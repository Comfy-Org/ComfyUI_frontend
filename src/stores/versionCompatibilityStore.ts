import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import config from '@/config'
import { useSettingStore } from '@/stores/settingStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { compareVersions, isSemVer } from '@/utils/formatUtil'

export const useVersionCompatibilityStore = defineStore(
  'versionCompatibility',
  () => {
    const systemStatsStore = useSystemStatsStore()
    const settingStore = useSettingStore()

    const isDismissed = ref(false)
    const dismissedVersion = ref<string | null>(null)

    const frontendVersion = computed(() => config.app_version)
    const backendVersion = computed(
      () => systemStatsStore.systemStats?.system?.comfyui_version ?? ''
    )
    const requiredFrontendVersion = computed(
      () =>
        systemStatsStore.systemStats?.system?.required_frontend_version ?? ''
    )

    const isFrontendOutdated = computed(() => {
      if (
        !frontendVersion.value ||
        !requiredFrontendVersion.value ||
        !isSemVer(frontendVersion.value) ||
        !isSemVer(requiredFrontendVersion.value)
      ) {
        return false
      }
      return (
        compareVersions(requiredFrontendVersion.value, frontendVersion.value) >
        0
      )
    })

    const isFrontendNewer = computed(() => {
      if (
        !frontendVersion.value ||
        !backendVersion.value ||
        !isSemVer(frontendVersion.value) ||
        !isSemVer(backendVersion.value)
      ) {
        return false
      }
      const versionDiff = compareVersions(
        frontendVersion.value,
        backendVersion.value
      )
      return versionDiff > 0
    })

    const hasVersionMismatch = computed(() => {
      return isFrontendOutdated.value || isFrontendNewer.value
    })

    const currentVersionKey = computed(
      () =>
        `${frontendVersion.value}-${backendVersion.value}-${requiredFrontendVersion.value}`
    )

    const shouldShowWarning = computed(() => {
      if (!hasVersionMismatch.value || isDismissed.value) {
        return false
      }
      return dismissedVersion.value !== currentVersionKey.value
    })

    const warningMessage = computed(() => {
      if (isFrontendOutdated.value) {
        return {
          type: 'outdated' as const,
          frontendVersion: frontendVersion.value,
          requiredVersion: requiredFrontendVersion.value
        }
      } else if (isFrontendNewer.value) {
        return {
          type: 'newer' as const,
          frontendVersion: frontendVersion.value,
          backendVersion: backendVersion.value
        }
      }
      return null
    })

    async function checkVersionCompatibility() {
      if (!systemStatsStore.systemStats) {
        await systemStatsStore.fetchSystemStats()
      }
    }

    async function dismissWarning() {
      isDismissed.value = true
      dismissedVersion.value = currentVersionKey.value

      await settingStore.set(
        'Comfy.VersionMismatch.DismissedVersion',
        currentVersionKey.value
      )
    }

    function restoreDismissalState() {
      const dismissed = settingStore.get(
        'Comfy.VersionMismatch.DismissedVersion'
      )
      if (dismissed) {
        dismissedVersion.value = dismissed
        isDismissed.value = dismissed === currentVersionKey.value
      }
    }

    async function initialize() {
      await checkVersionCompatibility()
      restoreDismissalState()
    }

    return {
      frontendVersion,
      backendVersion,
      requiredFrontendVersion,
      hasVersionMismatch,
      shouldShowWarning,
      warningMessage,
      isFrontendOutdated,
      isFrontendNewer,
      checkVersionCompatibility,
      dismissWarning,
      initialize
    }
  }
)
