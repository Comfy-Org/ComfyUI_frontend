import { computed, onMounted } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'
import { useInstalledPacks } from '@/workbench/extensions/manager/composables/nodePack/useInstalledPacks'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { getPackUpdateStatus } from '@/workbench/extensions/manager/utils/packUpdateStatus'

/**
 * Composable to find NodePacks that have updates available
 * Automatically fetches installed pack data when initialized
 */
export const useUpdateAvailableNodes = () => {
  const comfyManagerStore = useComfyManagerStore()
  const { installedPacks, isLoading, error, startFetchInstalled } =
    useInstalledPacks()

  const isOutdatedPack = (pack: components['schemas']['Node']) =>
    getPackUpdateStatus(pack, comfyManagerStore).isUpdateAvailable

  const filterOutdatedPacks = (packs: components['schemas']['Node'][]) =>
    packs.filter(isOutdatedPack)

  // Filter only outdated packs from installed packs
  const updateAvailableNodePacks = computed(() => {
    if (!installedPacks.value.length) return []
    return filterOutdatedPacks(installedPacks.value)
  })

  // Filter only enabled outdated packs
  const enabledUpdateAvailableNodePacks = computed(() => {
    return updateAvailableNodePacks.value.filter((pack) =>
      comfyManagerStore.isPackEnabled(pack.id)
    )
  })

  // Check if there are any enabled outdated packs
  const hasUpdateAvailable = computed(() => {
    return enabledUpdateAvailableNodePacks.value.length > 0
  })

  // Check if there are disabled packs with updates
  const hasDisabledUpdatePacks = computed(() => {
    return (
      updateAvailableNodePacks.value.length >
      enabledUpdateAvailableNodePacks.value.length
    )
  })

  // Automatically fetch installed pack data when composable is used
  onMounted(async () => {
    if (!installedPacks.value.length && !isLoading.value) {
      await startFetchInstalled()
    }
  })

  return {
    updateAvailableNodePacks,
    enabledUpdateAvailableNodePacks,
    hasUpdateAvailable,
    hasDisabledUpdatePacks,
    isLoading,
    error
  }
}
