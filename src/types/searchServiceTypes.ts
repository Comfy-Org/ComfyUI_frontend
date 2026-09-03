import type { SearchNodePacksParams } from '@/types/algoliaTypes'
import type { components } from '@/types/comfyRegistryTypes'

type RegistryNodePack = components['schemas']['Node']

/**
 * Search mode for filtering results
 */
export type SearchMode = 'nodes' | 'packs'
export type QuerySuggestion = {
  query: string
  popularity: number
}

export interface SearchPacksResult {
  nodePacks: RegistryNodePack[]
  querySuggestions: QuerySuggestion[]
}

export interface NodePackSearchProvider {
  /**
   * Search for node packs
   */
  searchPacks(
    query: string,
    params: SearchNodePacksParams
  ): Promise<SearchPacksResult>

  /**
   * Clear the search cache
   */
  clearSearchCache(): void
}
