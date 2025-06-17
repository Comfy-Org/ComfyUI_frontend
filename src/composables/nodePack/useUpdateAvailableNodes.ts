import { computed, onMounted } from 'vue'

import { useInstalledPacks } from '@/composables/nodePack/useInstalledPacks'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { components } from '@/types/comfyRegistryTypes'
import { compareVersions, isSemVer } from '@/utils/formatUtil'

/**
 * Composable to find NodePacks that have updates available
 * Uses the same filtering approach as ManagerDialogContent.vue
 * Automatically fetches installed pack data when initialized
 */
export const useUpdateAvailableNodes = () => {
  const comfyManagerStore = useComfyManagerStore()
  const { installedPacks, isLoading, error, startFetchInstalled } =
    useInstalledPacks()

  // Check if a pack has updates available (same logic as usePackUpdateStatus)
  const isOutdatedPack = (pack: components['schemas']['Node']) => {
    const isInstalled = comfyManagerStore.isPackInstalled(pack?.id)
    if (!isInstalled) return false

    const installedVersion = comfyManagerStore.getInstalledPackVersion(
      pack.id ?? ''
    )
    const latestVersion = pack.latest_version?.version

    const isNightlyPack = !!installedVersion && !isSemVer(installedVersion)

    if (isNightlyPack || !latestVersion) {
      return false
    }

    return compareVersions(latestVersion, installedVersion) > 0
  }

  // Same filtering logic as ManagerDialogContent.vue
  const filterOutdatedPacks = (packs: components['schemas']['Node'][]) =>
    packs.filter(isOutdatedPack)

  // Filter only outdated packs from installed packs
  const updateAvailableNodePacks = computed(() => {
    if (!installedPacks.value.length) return []
    return filterOutdatedPacks(installedPacks.value)
  })

  // Automatically fetch installed pack data when composable is used
  onMounted(async () => {
    if (!installedPacks.value.length && !isLoading.value) {
      await startFetchInstalled()
    }
  })

  return {
    updateAvailableNodePacks,
    isLoading,
    error
  }
}
