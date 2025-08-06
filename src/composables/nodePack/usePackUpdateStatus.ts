import * as semver from 'semver'
import { computed } from 'vue'

import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { components } from '@/types/comfyRegistryTypes'

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
    () => !!installedVersion.value && !semver.valid(installedVersion.value)
  )

  const isUpdateAvailable = computed(() => {
    if (!isInstalled.value || isNightlyPack.value || !latestVersion.value) {
      return false
    }
    const installedSemver = semver.coerce(installedVersion.value)
    const latestSemver = semver.coerce(latestVersion.value)
    if (!installedSemver || !latestSemver) return false
    return semver.gt(latestSemver, installedSemver)
  })

  return {
    isUpdateAvailable,
    isNightlyPack,
    installedVersion,
    latestVersion
  }
}
