import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { SearchNodePacksParams } from '@/types/algoliaTypes'
import type { components } from '@/types/comfyRegistryTypes'
import type {
  NodePackSearchProvider,
  SearchPacksResult,
  SortableField
} from '@/types/searchServiceTypes'

type RegistryNodePack = components['schemas']['Node']

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

    // Determine search mode based on searchable attributes
    const isNodeSearch = restrictSearchableAttributes?.includes('comfy_nodes')

    const searchParams = {
      search: isNodeSearch ? undefined : query,
      comfy_node_search: isNodeSearch ? query : undefined,
      limit: pageSize,
      offset: pageNumber * pageSize
    }

    const searchResult = await registryStore.search.call(searchParams)

    if (!searchResult || !searchResult.nodes) {
      return {
        nodePacks: [],
        querySuggestions: []
      }
    }

    return {
      nodePacks: searchResult.nodes,
      querySuggestions: [] // Registry doesn't support query suggestions
    }
  }

  const clearSearchCache = () => {
    registryStore.search.clear()
  }

  const getSortValue = (
    pack: RegistryNodePack,
    sortField: string
  ): string | number => {
    switch (sortField) {
      case 'downloads':
        return pack.downloads ?? 0
      case 'name':
        return pack.name ?? ''
      case 'publisher':
        return pack.publisher?.name ?? ''
      case 'updated':
        return pack.latest_version?.createdAt
          ? new Date(pack.latest_version.createdAt).getTime()
          : 0
      default:
        return 0
    }
  }

  const getSortableFields = (): SortableField[] => {
    return [
      { id: 'downloads', label: 'Downloads', direction: 'desc' },
      { id: 'name', label: 'Name', direction: 'asc' },
      { id: 'publisher', label: 'Publisher', direction: 'asc' },
      { id: 'updated', label: 'Updated', direction: 'desc' }
    ]
  }

  return {
    searchPacks,
    clearSearchCache,
    getSortValue,
    getSortableFields
  }
}
