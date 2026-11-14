import { computed, onMounted } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'
import { useInstalledPacks } from '@/platform/customNodes/manager/composables/nodePack/useInstalledPacks'
import { useComfyManagerStore } from '@/platform/customNodes/manager/stores/comfyManagerStore'
import { usePackUpdateStatuses } from '@/platform/customNodes/manager/composables/nodePack/usePackUpdateStatuses'

/**
 * Composable to find NodePacks that have updates available
 * Automatically fetches installed pack data when initialized
 */
export const useUpdateAvailableNodes = () => {
  const comfyManagerStore = useComfyManagerStore()
  const { installedPacks, isLoading, error, startFetchInstalled } =
    useInstalledPacks()

  const {
    getStatus,
    isLoading: isLoadingVersions,
    hasError
  } = usePackUpdateStatuses(installedPacks)

  const isOutdatedPack = (pack: components['schemas']['Node']) =>
    getStatus(pack).isUpdateAvailable

  const filterOutdatedPacks = (packs: components['schemas']['Node'][]) =>
    packs.filter(isOutdatedPack)

  const updateAvailableNodePacks = computed(() => {
    if (!installedPacks.value.length) return []
    return filterOutdatedPacks(installedPacks.value)
  })

  const enabledUpdateAvailableNodePacks = computed(() => {
    return updateAvailableNodePacks.value.filter((pack) =>
      comfyManagerStore.isPackEnabled(pack.id)
    )
  })

  const hasUpdateAvailable = computed(() => {
    return enabledUpdateAvailableNodePacks.value.length > 0
  })

  const hasDisabledUpdatePacks = computed(() => {
    return (
      updateAvailableNodePacks.value.length >
      enabledUpdateAvailableNodePacks.value.length
    )
  })

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
    isLoading: computed(() => isLoading.value || isLoadingVersions.value),
    error: computed(
      () =>
        error.value ??
        (hasError.value ? 'Failed to load update versions' : null)
    )
  }
}
