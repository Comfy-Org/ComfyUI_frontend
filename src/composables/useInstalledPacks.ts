import { chunk } from 'lodash'
import { onUnmounted } from 'vue'

import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import { components } from '@/types/comfyRegistryTypes'

const MAX_SIMULTANEOUS_REQUESTS = 8

export const useInstalledPacks = () => {
  const comfyManagerStore = useComfyManagerStore()
  const { getPackById, cancelRequests } = useComfyRegistryStore()

  const getInstalledIdsChunks = () =>
    chunk(
      Array.from(comfyManagerStore.installedPacksIds),
      MAX_SIMULTANEOUS_REQUESTS
    )

  const getInstalledPacks = async () => {
    const packs: components['schemas']['Node'][] = []
    for (const packIdsChunk of getInstalledIdsChunks()) {
      const requests = packIdsChunk.map((id) => getPackById(id))
      const responses = await Promise.all(requests)
      responses.forEach((pack) => {
        if (pack) packs.push(pack)
      })
    }
    return packs
  }

  onUnmounted(() => {
    cancelRequests()
  })

  return {
    getInstalledPacks
  }
}
