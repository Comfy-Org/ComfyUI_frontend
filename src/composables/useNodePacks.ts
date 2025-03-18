import { useAsyncState } from '@vueuse/core'
import { chunk } from 'lodash'
import { Ref, computed, isRef, ref } from 'vue'

import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import { UseNodePacksOptions } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'

const DEFAULT_MAX_CONCURRENT = 6

type NodePack = components['schemas']['Node']

/**
 * Handles fetching node packs from the registry given a list of node pack IDs
 */
export const useNodePacks = (
  packsIds: string[] | Ref<string[]>,
  options: UseNodePacksOptions = {}
) => {
  const { immediate = false, maxConcurrent = DEFAULT_MAX_CONCURRENT } = options
  const { getPackById, cancelRequests } = useComfyRegistryStore()

  const nodePacks = ref<NodePack[]>([])
  const processedIds = ref<Set<string>>(new Set())

  const queuedPackIds = isRef(packsIds) ? packsIds : ref<string[]>(packsIds)
  const remainingIds = computed(() =>
    queuedPackIds.value?.filter((id) => !processedIds.value.has(id))
  )
  const chunks = computed(() =>
    remainingIds.value?.length ? chunk(remainingIds.value, maxConcurrent) : []
  )

  const fetchPack = (ids: Parameters<typeof getPackById>[0]) =>
    ids ? getPackById(ids) : null

  const toRequestBatch = async (ids: string[]) =>
    Promise.all(ids.map(fetchPack))

  const isValidResponse = (response: NodePack | null) => response !== null

  const fetchPacks = async () => {
    for (const chunk of chunks.value) {
      const resolvedChunk = await toRequestBatch(chunk)
      chunk.forEach((id) => processedIds.value.add(id))
      if (!resolvedChunk) continue
      nodePacks.value.push(...resolvedChunk.filter(isValidResponse))
    }
  }

  const { isReady, isLoading, error, execute } = useAsyncState(
    fetchPacks,
    null,
    {
      immediate
    }
  )

  const clear = () => {
    queuedPackIds.value = []
    isReady.value = false
    isLoading.value = false
  }

  const cleanup = () => {
    cancelRequests()
    clear()
  }

  return {
    error,
    isLoading,
    isReady,
    nodePacks,
    startFetch: execute,
    cleanup
  }
}
