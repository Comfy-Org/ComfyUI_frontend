import { whenever } from '@vueuse/core'
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

  const startFetchInstalled = async () => {
    // Only refresh if store doesn't have data yet
    if (comfyManagerStore.installedPacksIds.size === 0) {
      await comfyManagerStore.refreshInstalledList()
    }
    await startFetch()
  }

  // When installedPackIds changes, we need to update the nodePacks
  whenever(installedPackIds, async () => {
    await startFetch()
  })

  onUnmounted(() => {
    cleanup()
  })

  // Create a computed property that provides installed pack info with versions
  const installedPacksWithVersions = computed(() => {
    const result: Array<{ id: string; version: string }> = []

    for (const pack of Object.values(comfyManagerStore.installedPacks)) {
      const id = pack.cnr_id || pack.aux_id
      if (id) {
        result.push({
          id,
          version: pack.ver
        })
      }
    }

    return result
  })

  return {
    error,
    isLoading,
    isReady,
    installedPacks: nodePacks,
    installedPacksWithVersions,
    startFetchInstalled,
    filterInstalledPack
  }
}
