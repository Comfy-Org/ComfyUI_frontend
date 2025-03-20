import { defineStore } from 'pinia'

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
type GetPackByIdPath = operations['getNode']['parameters']['path']['nodeId']

/**
 * Store for managing remote custom nodes
 */
export const useComfyRegistryStore = defineStore('comfyRegistry', () => {
  const registryService = useComfyRegistryService()

  /**
   * Get a list of all node packs from the registry
   */
  const listAllPacks = useCachedRequest<ListPacksParams, ListPacksResult>(
    registryService.listAllPacks,
    { maxSize: PACK_LIST_CACHE_SIZE }
  )

  /**
   * Get a pack by its ID from the registry
   */
  const getPackById = useCachedRequest<GetPackByIdPath, NodePack>(
    async (params) => {
      if (!params) return null
      return registryService.getPackById(params)
    },
    { maxSize: PACK_BY_ID_CACHE_SIZE }
  )

  /**
   * Get the node definitions for a pack
   */
  const getNodeDefs = useCachedRequest<
    { packId: string; versionId: string },
    ComfyNode[]
  >(registryService.getNodeDefs, { maxSize: PACK_BY_ID_CACHE_SIZE })

  /**
   * Clear all cached data
   */
  const clearCache = () => {
    getNodeDefs.clear()
    listAllPacks.clear()
    getPackById.clear()
  }

  /**
   * Cancel all any in-flight requests.
   */
  const cancelRequests = () => {
    getNodeDefs.cancel()
    listAllPacks.cancel()
    getPackById.cancel()
  }

  return {
    listAllPacks,
    getPackById,
    getNodeDefs,

    clearCache,
    cancelRequests,

    isLoading: registryService.isLoading,
    error: registryService.error
  }
})
