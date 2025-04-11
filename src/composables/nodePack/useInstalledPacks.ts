import { computed, onUnmounted } from 'vue'

import { useNodePacks } from '@/composables/nodePack/useNodePacks'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { UseNodePacksOptions } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

export const useInstalledPacks = (options: UseNodePacksOptions = {}) => {
  const comfyManagerStore = useComfyManagerStore()

  const installedPackIds = computed(() =>
    Array.from(comfyManagerStore.installedPacksIds)
  )

  const { startFetch, cleanup, error, isLoading, nodePacks, isReady } =
    useNodePacks(installedPackIds, options)

  const filterInstalledPack = (packs: components['schemas']['Node'][]) =>
    packs.filter((pack) => comfyManagerStore.isPackInstalled(pack.id))

  onUnmounted(() => {
    cleanup()
  })

  return {
    error,
    isLoading,
    isReady,
    installedPacks: nodePacks,
    startFetchInstalled: startFetch,
    filterInstalledPack
  }
}
