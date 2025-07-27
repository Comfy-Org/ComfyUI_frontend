import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import * as semver from 'semver'
import { computed } from 'vue'

import config from '@/config'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

const DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

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
        !semver.valid(frontendVersion.value) ||
        !semver.valid(requiredFrontendVersion.value)
      ) {
        return false
      }
      // Returns true if required version is greater than frontend version
      return semver.gt(requiredFrontendVersion.value, frontendVersion.value)
    })

    const isFrontendNewer = computed(() => {
      // Only check if all versions are valid semver
      if (
        !frontendVersion.value ||
        !backendVersion.value ||
        !semver.valid(frontendVersion.value) ||
        !semver.valid(backendVersion.value)
      ) {
        return false
      }

      // Check if frontend is newer than backend
      if (!semver.gt(frontendVersion.value, backendVersion.value)) {
        return false
      }

      // If there's a required version specified by the backend
      if (
        requiredFrontendVersion.value &&
        semver.valid(requiredFrontendVersion.value)
      ) {
        // If frontend version satisfies the required version, no warning needed
        // Using satisfies allows for more flexible version matching (e.g., ^1.2.0, ~1.2.0)
        // For exact version matching, we check if versions are within acceptable range

        // If frontend equals required version exactly, no warning
        if (semver.eq(frontendVersion.value, requiredFrontendVersion.value)) {
          return false
        }

        // If frontend is behind required version, let isFrontendOutdated handle it
        if (semver.lt(frontendVersion.value, requiredFrontendVersion.value)) {
          return false
        }

        // Frontend is ahead of required version - check if it's significantly ahead
        const frontendMajor = semver.major(frontendVersion.value)
        const frontendMinor = semver.minor(frontendVersion.value)
        const requiredMajor = semver.major(requiredFrontendVersion.value)
        const requiredMinor = semver.minor(requiredFrontendVersion.value)

        // If major versions differ, warn
        if (frontendMajor !== requiredMajor) return true

        // If same major but more than 2 minor versions ahead, warn
        if (frontendMinor - requiredMinor > 2) return true

        // Otherwise, frontend is reasonably close to required version, no warning
        return false
      }

      // No required version specified but frontend is newer than backend
      // This is likely problematic, so warn
      return true
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

    // Use reactive storage for dismissals - creates a reactive ref that syncs with localStorage
    // All version mismatch dismissals are stored in a single object for clean localStorage organization
    const dismissalStorage = useStorage(
      'comfy.versionMismatch.dismissals',
      {} as Record<string, number>,
      localStorage,
      {
        serializer: {
          read: (value: string) => {
            try {
              return JSON.parse(value)
            } catch {
              return {}
            }
          },
          write: (value: Record<string, number>) => JSON.stringify(value)
        }
      }
    )

    const isDismissed = computed(() => {
      if (!versionKey.value) return false

      const dismissedUntil = dismissalStorage.value[versionKey.value]
      if (!dismissedUntil) return false

      // Check if dismissal has expired
      return Date.now() < dismissedUntil
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
      if (!versionKey.value) return

      const dismissUntil = Date.now() + DISMISSAL_DURATION_MS
      dismissalStorage.value = {
        ...dismissalStorage.value,
        [versionKey.value]: dismissUntil
      }
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
