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
  /** Whether the raw query has pages past this one; omitted when unknown. */
  hasMore?: boolean
  /** Whether the raw query matched nothing, even if fallback hits were returned. */
  rawResultsEmpty?: boolean
}

export type SearchPacksOutcome =
  | { ok: true; result: SearchPacksResult }
  | { ok: false; cause: unknown }

export interface NodePackSearchProvider {
  /**
   * Search for node packs; a failed search resolves to `ok: false`.
   */
  searchPacks(
    query: string,
    params: SearchNodePacksParams
  ): Promise<SearchPacksOutcome>

  /**
   * Clear the search cache
   */
  clearSearchCache(): void
}
