import { computed } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'
import { compareVersions, isSemVer } from '@/utils/formatUtil'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

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
    () => !!installedVersion.value && !isSemVer(installedVersion.value)
  )

  const isUpdateAvailable = computed(() => {
    if (!isInstalled.value || isNightlyPack.value || !latestVersion.value) {
      return false
    }
    return compareVersions(latestVersion.value, installedVersion.value) > 0
  })

  return {
    isUpdateAvailable,
    isNightlyPack,
    installedVersion,
    latestVersion
  }
}
