import { computed, onUnmounted } from 'vue'

import { useNodePacks } from '@/composables/useNodePacks'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { UseNodePacksOptions } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

export const useInstalledPacks = (options: UseNodePacksOptions = {}) => {
  const comfyManagerStore = useComfyManagerStore()

  const installedPackIds = computed(() =>
    Array.from(comfyManagerStore.installedPacksIds)
  )

  const { startFetch, cleanup, error, isLoading, nodePacks } = useNodePacks(
    installedPackIds,
    options
  )

  const filterInstalledPack = (packs: components['schemas']['Node'][]) =>
    packs.filter((pack) => comfyManagerStore.isPackInstalled(pack.id))

  onUnmounted(() => {
    cleanup()
  })

  return {
    error,
    isLoading,
    installedPacks: nodePacks,
    startFetchInstalled: startFetch,
    filterInstalledPack
  }
}
