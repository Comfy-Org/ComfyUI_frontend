import QuickLRU from '@alloc/quick-lru'
import { partition } from 'es-toolkit/compat'
import { defineStore } from 'pinia'

import { useCachedRequest } from '@/composables/useCachedRequest'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import type { components, operations } from '@/types/comfyRegistryTypes'

const PACK_LIST_CACHE_SIZE = 20
const PACK_BY_ID_CACHE_SIZE = 64

type NodePack = components['schemas']['Node']
type ListPacksParams = operations['listAllNodes']['parameters']['query']
type ListPacksResult =
  operations['listAllNodes']['responses'][200]['content']['application/json']
type GetNodeDefsParams = operations['ListComfyNodes']['parameters']['query'] & {
  packId: components['schemas']['Node']['id']
  version: components['schemas']['NodeVersion']['version']
}
type GetPackByIdPath = operations['getNode']['parameters']['path']['nodeId']

const isNodePack = (pack: NodePack | undefined): pack is NodePack => {
  return pack !== undefined && 'id' in pack
}

/**
 * Store for managing remote custom nodes
 */
export const useComfyRegistryStore = defineStore('comfyRegistry', () => {
  const registryService = useComfyRegistryService()

  let getPacksByIdController: AbortController | null = null
  const getPacksByIdCache = new QuickLRU<NodePack['id'], NodePack>({
    maxSize: PACK_BY_ID_CACHE_SIZE
  })

  const listAllPacks = useCachedRequest<ListPacksParams, ListPacksResult>(
    registryService.listAllPacks,
    { maxSize: PACK_LIST_CACHE_SIZE }
  )

  const getPackById = useCachedRequest<GetPackByIdPath, NodePack>(
    async (params) => {
      if (!params) return null
      return registryService.getPackById(params)
    },
    { maxSize: PACK_BY_ID_CACHE_SIZE }
  )

  const getPacksByIds = async (ids: NodePack['id'][]): Promise<NodePack[]> => {
    const [cachedPacksIds, uncachedPacksIds] = partition(ids, (id) =>
      getPacksByIdCache.has(id)
    )

    const resolvedPacks = cachedPacksIds
      .map((id) => getPacksByIdCache.get(id))
      .filter(isNodePack)

    if (uncachedPacksIds.length) {
      getPacksByIdController = new AbortController()
      const uncachedPacks = await registryService.listAllPacks(
        {
          node_id: uncachedPacksIds.filter(
            (id): id is string => id !== undefined
          )
        },
        getPacksByIdController.signal
      )

      const { nodes = [] } = uncachedPacks ?? {}
      nodes.forEach((pack) => {
        if (pack.id) {
          getPacksByIdCache.set(pack.id, pack)
          resolvedPacks.push(pack)
        }
      })
    }

    return resolvedPacks
  }

  const getActivePackVersions = useCachedRequest<
    { id: string; advertisedVersion?: string; advertisedStatus?: string },
    components['schemas']['NodeVersion'][]
  >(
    ({ id }, signal) =>
      registryService.getPackVersions(
        id,
        { statuses: ['NodeVersionStatusActive'] },
        signal
      ),
    { maxSize: PACK_BY_ID_CACHE_SIZE }
  )

  const getNodeDefs = useCachedRequest<
    GetNodeDefsParams,
    operations['ListComfyNodes']['responses'][200]['content']['application/json']
  >(registryService.getNodeDefs, { maxSize: PACK_BY_ID_CACHE_SIZE })

  const search = useCachedRequest<
    operations['searchNodes']['parameters']['query'],
    ListPacksResult
  >(registryService.search, { maxSize: PACK_LIST_CACHE_SIZE })

  const inferPackFromNodeName = useCachedRequest<
    operations['getNodeByComfyNodeName']['parameters']['path']['comfyNodeName'],
    NodePack
  >(registryService.inferPackFromNodeName, { maxSize: PACK_BY_ID_CACHE_SIZE })

  const clearCache = () => {
    getActivePackVersions.clear()
    getNodeDefs.clear()
    listAllPacks.clear()
    getPackById.clear()
    inferPackFromNodeName.clear()
  }

  const cancelRequests = () => {
    getActivePackVersions.cancel()
    getNodeDefs.cancel()
    listAllPacks.cancel()
    getPackById.cancel()
    inferPackFromNodeName.cancel()
    getPacksByIdController?.abort()
  }

  return {
    listAllPacks,
    getPackById,
    getPacksByIds: {
      call: getPacksByIds,
      cancel: () => getPacksByIdController?.abort()
    },
    getActivePackVersions,
    getNodeDefs,
    search,
    inferPackFromNodeName,

    clearCache,
    cancelRequests,

    isLoading: registryService.isLoading,
    error: registryService.error
  }
})
