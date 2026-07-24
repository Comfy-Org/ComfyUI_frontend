import { until, useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { coerce, gt } from 'semver'
import { computed } from 'vue'

import config from '@/config'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

interface OutdatedComfyPackage {
  name: string
  installed: string
  required: string
}

const DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Already covered by the dedicated frontend warning, which uses the
// running bundle's version rather than the installed pip version.
const FRONTEND_PACKAGE_NAME = 'comfyui-frontend-package'

// Backend reports PEP 440 versions (e.g. "0.3.0.post1", "1.0.0rc1");
// coerce strips the suffix so we can compare with semver. Note: this means
// "0.4.0" vs "0.4.0.post1" both coerce to "0.4.0" and compare equal — a
// post-release alone is not treated as outdated.
function isOutdated(installed: string, required: string): boolean {
  const installedSemver = coerce(installed)
  const requiredSemver = coerce(required)
  if (!installedSemver || !requiredSemver) return false
  return gt(requiredSemver, installedSemver)
}

export const useVersionCompatibilityStore = defineStore(
  'versionCompatibility',
  () => {
    const systemStatsStore = useSystemStatsStore()
    const settingStore = useSettingStore()

    const frontendVersion = computed(() => config.app_version)
    const backendVersion = computed(
      () => systemStatsStore.systemStats?.system?.comfyui_version ?? ''
    )
    const requiredFrontendVersion = computed(
      () =>
        systemStatsStore.systemStats?.system?.required_frontend_version ?? ''
    )

    const isFrontendOutdated = computed(() => {
      if (!frontendVersion.value || !requiredFrontendVersion.value) return false
      return isOutdated(frontendVersion.value, requiredFrontendVersion.value)
    })

    const isFrontendNewer = computed(() => {
      // We don't warn about frontend being newer than backend
      // Only warn when frontend is outdated (behind required version)
      return false
    })

    const outdatedComfyPackages = computed<OutdatedComfyPackage[]>(() => {
      const packages =
        systemStatsStore.systemStats?.system?.comfy_package_versions ?? []
      const out: OutdatedComfyPackage[] = []
      for (const pkg of packages) {
        if (pkg.name === FRONTEND_PACKAGE_NAME) continue
        if (!pkg.installed || !pkg.required) continue
        if (!isOutdated(pkg.installed, pkg.required)) continue
        out.push({
          name: pkg.name,
          installed: pkg.installed,
          required: pkg.required
        })
      }
      return out
    })

    const hasVersionMismatch = computed(() => {
      return isFrontendOutdated.value || outdatedComfyPackages.value.length > 0
    })

    const versionKey = computed(() => {
      if (!frontendVersion.value) return null
      if (
        !backendVersion.value &&
        !requiredFrontendVersion.value &&
        outdatedComfyPackages.value.length === 0
      ) {
        return null
      }
      const baseKey = `${frontendVersion.value}-${backendVersion.value}-${requiredFrontendVersion.value}`
      if (outdatedComfyPackages.value.length === 0) return baseKey
      const packageKey = [...outdatedComfyPackages.value]
        .sort(
          (a, b) =>
            a.name.localeCompare(b.name) ||
            a.installed.localeCompare(b.installed) ||
            a.required.localeCompare(b.required)
        )
        .map((pkg) => `${pkg.name}@${pkg.installed}->${pkg.required}`)
        .join(',')
      return `${baseKey}-${packageKey}`
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

    const warningsDisabled = computed(() =>
      settingStore.get('Comfy.VersionCompatibility.DisableWarnings')
    )

    const shouldShowWarning = computed(() => {
      return (
        hasVersionMismatch.value &&
        !isDismissed.value &&
        !warningsDisabled.value
      )
    })

    const warningMessage = computed(() => {
      if (isFrontendOutdated.value) {
        return {
          type: 'outdated' as const,
          frontendVersion: frontendVersion.value,
          requiredVersion: requiredFrontendVersion.value
        }
      }
      return null
    })

    const packageWarningMessages = computed(() =>
      outdatedComfyPackages.value.map((pkg) => ({
        name: pkg.name,
        installedVersion: pkg.installed,
        requiredVersion: pkg.required
      }))
    )

    async function checkVersionCompatibility() {
      if (!systemStatsStore.systemStats) {
        await until(systemStatsStore.isInitialized)
      }
    }

    function dismissWarning() {
      if (!versionKey.value) return

      const now = Date.now()
      const pruned: Record<string, number> = {}
      for (const [key, until] of Object.entries(dismissalStorage.value)) {
        if (until > now) pruned[key] = until
      }
      pruned[versionKey.value] = now + DISMISSAL_DURATION_MS
      dismissalStorage.value = pruned
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
      packageWarningMessages,
      outdatedComfyPackages,
      isFrontendOutdated,
      isFrontendNewer,
      checkVersionCompatibility,
      dismissWarning,
      initialize
    }
  }
)
