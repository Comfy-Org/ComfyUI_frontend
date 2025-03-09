import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useCachedRequest } from '@/composables/useCachedRequest'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import type { components, operations } from '@/types/comfyRegistryTypes'

const PACK_LIST_CACHE_SIZE = 20
const PACK_BY_ID_CACHE_SIZE = 50

type NodePack = components['schemas']['Node']
type ListPacksParams = operations['listAllNodes']['parameters']['query']
type ListPacksResult =
  operations['listAllNodes']['responses'][200]['content']['application/json']
type ComfyNode = components['schemas']['ComfyNode']

/**
 * Store for managing remote custom nodes
 */
export const useComfyRegistryStore = defineStore('comfyRegistry', () => {
  const registryService = useComfyRegistryService()

  let listAllPacksHandler: ReturnType<
    typeof useCachedRequest<ListPacksParams, ListPacksResult>
  >
  let getPackByIdHandler: ReturnType<typeof useCachedRequest<string, NodePack>>
  let getNodeDefsHandler: ReturnType<
    typeof useCachedRequest<{ packId: string; versionId: string }, ComfyNode[]>
  >

  const recentListResult = ref<NodePack[]>([])
  const hasPacks = computed(() => recentListResult.value.length > 0)

  /**
   * Get a list of all node packs from the registry
   */
  const listAllPacks = async (params: ListPacksParams) => {
    listAllPacksHandler ??= useCachedRequest<ListPacksParams, ListPacksResult>(
      registryService.listAllPacks,
      { maxSize: PACK_LIST_CACHE_SIZE }
    )

    const response = await listAllPacksHandler.call(params)
    if (response) recentListResult.value = response.nodes || []

    return response
  }

  /**
   * Get a pack by its ID from the registry
   */
  const getPackById = async (
    packId: NodePack['id']
  ): Promise<NodePack | null> => {
    if (!packId) return null

    getPackByIdHandler ??= useCachedRequest<string, NodePack>(
      registryService.getPackById,
      { maxSize: PACK_BY_ID_CACHE_SIZE }
    )

    return getPackByIdHandler.call(packId)
  }

  /**
   * Get the node definitions for a pack
   */
  const getNodeDefs = async (
    packId: NodePack['id'],
    versionId: NonNullable<NodePack['latest_version']>['id']
  ) => {
    if (!packId || !versionId) return null

    getNodeDefsHandler ??= useCachedRequest<
      { packId: string; versionId: string },
      ComfyNode[]
    >(registryService.getNodeDefs, { maxSize: PACK_BY_ID_CACHE_SIZE })

    return getNodeDefsHandler.call({ packId, versionId })
  }

  /**
   * Clear all cached data
   */
  const clearCache = () => {
    listAllPacksHandler?.clear()
    getPackByIdHandler?.clear()
  }

  /**
   * Cancel any in-flight requests
   */
  const cancelRequests = () => {
    listAllPacksHandler?.cancel()
    getPackByIdHandler?.cancel()
  }

  return {
    recentListResult,
    hasPacks,

    listAllPacks,
    getPackById,
    getNodeDefs,

    clearCache,
    cancelRequests,

    isLoading: registryService.isLoading,
    error: registryService.error
  }
})
