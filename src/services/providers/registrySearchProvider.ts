import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { SearchNodePacksParams } from '@/types/algoliaTypes'
import type {
  NodePackSearchProvider,
  SearchPacksResult
} from '@/types/searchServiceTypes'

class RegistrySearchRequestError extends Error {}

interface CachedRegistryRequest<TParams, TResult> {
  call: (params: TParams) => Promise<TResult | null>
  evict: (params: TParams) => void
}

/**
 * Search provider for the Comfy Registry.
 * Uses public Comfy Registry API.
 */
export const useComfyRegistrySearchProvider = (): NodePackSearchProvider => {
  const registryStore = useComfyRegistryStore()

  const requestRegistry = async <TParams, TResult>(
    request: CachedRegistryRequest<TParams, TResult>,
    params: TParams
  ): Promise<TResult> => {
    const response = await request.call(params)
    if (response) return response
    request.evict(params)
    const cause = registryStore.error
    throw new RegistrySearchRequestError(
      cause
        ? `Comfy Registry request failed: ${cause}`
        : 'Comfy Registry request failed'
    )
  }

  const searchPacks = async (
    query: string,
    params: SearchNodePacksParams
  ): Promise<SearchPacksResult> => {
    const { pageSize, pageNumber, restrictSearchableAttributes } = params
    const registryPage = pageNumber + 1

    if (!query || query.trim() === '') {
      const listResult = await requestRegistry(registryStore.listAllPacks, {
        limit: pageSize,
        page: registryPage
      })

      return {
        nodePacks: listResult.nodes ?? [],
        querySuggestions: []
      }
    }

    const isNodeSearch = restrictSearchableAttributes?.includes('comfy_nodes')

    const searchResult = await requestRegistry(registryStore.search, {
      search: isNodeSearch ? undefined : query,
      comfy_node_search: isNodeSearch ? query : undefined,
      limit: pageSize,
      page: registryPage
    })

    return {
      nodePacks: searchResult.nodes ?? [],
      querySuggestions: []
    }
  }

  const clearSearchCache = () => {
    registryStore.search.clear()
    registryStore.listAllPacks.clear()
  }

  return {
    searchPacks,
    clearSearchCache
  }
}
