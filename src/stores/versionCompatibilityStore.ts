import { defineStore } from 'pinia'
import { computed } from 'vue'

import config from '@/config'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { compareVersions, isSemVer } from '@/utils/formatUtil'

const DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const DISMISSAL_KEY_PREFIX = 'comfy.versionMismatch.dismissed.'

export const useVersionCompatibilityStore = defineStore(
  'versionCompatibility',
  () => {
    const systemStatsStore = useSystemStatsStore()

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

    const versionKey = computed(() => {
      if (
        !frontendVersion.value ||
        !backendVersion.value ||
        !requiredFrontendVersion.value
      ) {
        return null
      }
      return `${frontendVersion.value}-${backendVersion.value}-${requiredFrontendVersion.value}`
    })

    const dismissalKey = computed(() => {
      if (!versionKey.value) return null
      return DISMISSAL_KEY_PREFIX + versionKey.value
    })

    const isDismissed = computed(() => {
      if (!dismissalKey.value) return false

      const dismissedUntil = localStorage.getItem(dismissalKey.value)

      if (!dismissedUntil) return false

      const dismissedUntilTime = parseInt(dismissedUntil, 10)
      if (isNaN(dismissedUntilTime)) return false

      // Check if dismissal has expired
      return Date.now() < dismissedUntilTime
    })

    const shouldShowWarning = computed(() => {
      return hasVersionMismatch.value && !isDismissed.value
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

    function dismissWarning() {
      if (!dismissalKey.value) return

      const dismissUntil = Date.now() + DISMISSAL_DURATION_MS
      localStorage.setItem(dismissalKey.value, dismissUntil.toString())
    }

    async function initialize() {
      await checkVersionCompatibility()
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
