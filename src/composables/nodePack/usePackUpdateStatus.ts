import { gt } from 'semver'
import { computed } from 'vue'

import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { components } from '@/types/comfyRegistryTypes'
import { coerceVersion, isNightlyVersion } from '@/utils/versionUtil'

export const usePackUpdateStatus = (
  nodePack: components['schemas']['Node']
) => {
  const { isPackInstalled, getInstalledPackVersion } = useComfyManagerStore()

  const isInstalled = computed(() => isPackInstalled(nodePack?.id))
  const installedVersion = computed(() =>
    getInstalledPackVersion(nodePack.id ?? '')
  )
  const latestVersion = computed(() => nodePack.latest_version?.version)

  const isNightlyPack = computed(
    () => !!installedVersion.value && isNightlyVersion(installedVersion.value)
  )

  const coercedInstalledVersion = computed(() =>
    installedVersion.value ? coerceVersion(installedVersion.value) : null
  )

  const coercedLatestVersion = computed(() =>
    latestVersion.value ? coerceVersion(latestVersion.value) : null
  )

  const isUpdateAvailable = computed(() => {
    if (!isInstalled.value || isNightlyPack.value || !latestVersion.value) {
      return false
    }
    if (!coercedInstalledVersion.value || !coercedLatestVersion.value) {
      return false
    }
    return gt(coercedLatestVersion.value, coercedInstalledVersion.value)
  })

  return {
    isUpdateAvailable,
    isNightlyPack,
    installedVersion,
    latestVersion
  }
}
