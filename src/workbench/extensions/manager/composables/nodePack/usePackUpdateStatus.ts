import { compare, valid } from 'semver'
import { computed } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

export const usePackUpdateStatus = (
  nodePack: components['schemas']['Node']
) => {
  const { isPackInstalled, isPackEnabled, getInstalledPackVersion } =
    useComfyManagerStore()

  const isInstalled = computed(() => isPackInstalled(nodePack?.id))
  const isEnabled = computed(() => isPackEnabled(nodePack?.id))
  const installedVersion = computed(() =>
    getInstalledPackVersion(nodePack.id ?? '')
  )
  const latestVersion = computed(() => nodePack.latest_version?.version)

  const isNightlyPack = computed(
    () => !!installedVersion.value && !valid(installedVersion.value)
  )

  const isUpdateAvailable = computed(() => {
    if (
      !isInstalled.value ||
      isNightlyPack.value ||
      !latestVersion.value ||
      !installedVersion.value
    ) {
      return false
    }
    return compare(latestVersion.value, installedVersion.value) > 0
  })

  /**
   * Nightly packs can always "try update" since we cannot compare git hashes
   * to determine if an update is actually available. This allows users to
   * pull the latest changes from the repository.
   */
  const canTryNightlyUpdate = computed(
    () => isInstalled.value && isEnabled.value && isNightlyPack.value
  )

  return {
    isUpdateAvailable,
    isNightlyPack,
    canTryNightlyUpdate,
    installedVersion,
    latestVersion
  }
}
