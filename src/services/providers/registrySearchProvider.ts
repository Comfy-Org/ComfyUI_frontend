import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { SearchNodePacksParams } from '@/types/algoliaTypes'
import type {
  NodePackSearchProvider,
  SearchPacksResult
} from '@/types/searchServiceTypes'

/**
 * Search provider for the Comfy Registry.
 * Uses public Comfy Registry API.
 */
export const useComfyRegistrySearchProvider = (): NodePackSearchProvider => {
  const registryStore = useComfyRegistryStore()

  /**
   * Search for node packs using the Comfy Registry API.
   */
  const searchPacks = async (
    query: string,
    params: SearchNodePacksParams
  ): Promise<SearchPacksResult> => {
    const { pageSize, pageNumber, restrictSearchableAttributes } = params

    // For empty queries, use the cached listAllPacks endpoint instead of search
    if (!query || query.trim() === '') {
      const listParams = {
        limit: pageSize,
        page: pageNumber + 1 // Registry API uses 1-based pagination
        // Note: omitting 'latest' parameter defaults to cached result
      }

      const listResult = await registryStore.listAllPacks.call(listParams)
      const nodePacks = listResult?.nodes ?? []

      return {
        nodePacks,
        querySuggestions: []
      }
    }

    // For non-empty queries, use the search endpoint
    const isNodeSearch = restrictSearchableAttributes?.includes('comfy_nodes')

    const searchParams = {
      search: isNodeSearch ? undefined : query,
      comfy_node_search: isNodeSearch ? query : undefined,
      limit: pageSize,
      page: pageNumber + 1
    }

    const searchResult = await registryStore.search.call(searchParams)
    const nodePacks = searchResult?.nodes ?? []

    return {
      nodePacks,
      querySuggestions: [] // Registry doesn't support query suggestions
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
