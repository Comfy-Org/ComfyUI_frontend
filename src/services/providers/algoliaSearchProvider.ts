import QuickLRU from '@alloc/quick-lru'
import type {
  SearchQuery,
  SearchResponse
} from 'algoliasearch/dist/lite/browser'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import { uniqBy } from 'es-toolkit'
import { memoize, omit } from 'es-toolkit/compat'

import {
  MIN_CHARS_FOR_SUGGESTIONS_ALGOLIA,
  SEARCH_CACHE_MAX_SIZE
} from '@/constants/searchConstants'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  AlgoliaNodePack,
  NodesIndexSuggestion,
  SearchAttribute,
  SearchNodePacksParams
} from '@/types/algoliaTypes'
import type { components } from '@/types/comfyRegistryTypes'
import type {
  NodePackSearchProvider,
  SearchPacksResult
} from '@/types/searchServiceTypes'
import { paramsToCacheKey } from '@/utils/formatUtil'
import { buildPackSearchFallbacks } from '@/utils/searchQueryUtil'

type RegistryNodePack = components['schemas']['Node']

const RETRIEVE_ATTRIBUTES: SearchAttribute[] = [
  'comfy_nodes',
  'name',
  'description',
  'latest_version',
  'status',
  'publisher_id',
  'total_install',
  'create_time',
  'update_time',
  'license',
  'repository_url',
  'latest_version_status',
  'comfy_node_extract_status',
  'id',
  'icon_url',
  'github_stars',
  'supported_os',
  'supported_comfyui_version',
  'supported_comfyui_frontend_version',
  'supported_accelerators',
  'banner_url'
]

const searchPacksCache = new QuickLRU<string, SearchPacksResult>({
  maxSize: SEARCH_CACHE_MAX_SIZE
})

const toRegistryLatestVersion = (
  algoliaNode: AlgoliaNodePack
): RegistryNodePack['latest_version'] => {
  return {
    version: algoliaNode.latest_version,
    createdAt: algoliaNode.update_time,
    status: algoliaNode.latest_version_status,
    comfy_node_extract_status:
      algoliaNode.comfy_node_extract_status ?? undefined
  }
}

const toRegistryPublisher = (
  algoliaNode: AlgoliaNodePack
): RegistryNodePack['publisher'] => {
  return {
    id: algoliaNode.publisher_id,
    name: algoliaNode.publisher_id
  }
}

/**
 * Convert from node pack in Algolia format to Comfy Registry format
 */
const toRegistryPack = memoize(
  (
    algoliaNode: AlgoliaNodePack
  ): RegistryNodePack & { comfy_nodes: string[] } => {
    return {
      id: algoliaNode.id ?? algoliaNode.objectID,
      name: algoliaNode.name,
      description: algoliaNode.description,
      repository: algoliaNode.repository_url,
      license: algoliaNode.license,
      downloads: algoliaNode.total_install,
      status: algoliaNode.status,
      icon: algoliaNode.icon_url,
      latest_version: toRegistryLatestVersion(algoliaNode),
      publisher: toRegistryPublisher(algoliaNode),
      created_at: algoliaNode.create_time,
      category: algoliaNode.category,
      author: algoliaNode.author,
      tags: algoliaNode.tags,
      github_stars: algoliaNode.github_stars,
      supported_os: algoliaNode.supported_os,
      supported_comfyui_version: algoliaNode.supported_comfyui_version,
      supported_comfyui_frontend_version:
        algoliaNode.supported_comfyui_frontend_version,
      supported_accelerators: algoliaNode.supported_accelerators,
      banner_url: algoliaNode.banner_url,
      comfy_nodes: algoliaNode.comfy_nodes
    }
  },
  (algoliaNode: AlgoliaNodePack) => algoliaNode.id ?? algoliaNode.objectID
)

export const useAlgoliaSearchProvider = (): NodePackSearchProvider => {
  const searchClient = algoliasearch(__ALGOLIA_APP_ID__, __ALGOLIA_API_KEY__)

  const searchPacksInternal = async (
    query: string,
    params: SearchNodePacksParams
  ): Promise<{ result: SearchPacksResult; fallbacksFailed: boolean }> => {
    const { pageSize, pageNumber } = params
    const rest = omit(params, ['pageSize', 'pageNumber'])

    function packQuery(queryText: string): SearchQuery {
      return {
        query: queryText,
        indexName: 'nodes_index',
        attributesToRetrieve: RETRIEVE_ATTRIBUTES,
        ...rest,
        hitsPerPage: pageSize,
        page: pageNumber
      }
    }

    async function searchFallbacks(
      fallbackQueries: string[]
    ): Promise<AlgoliaNodePack[] | undefined> {
      if (fallbackQueries.length === 0) return []
      try {
        const { results } = await searchClient.search<AlgoliaNodePack>({
          requests: fallbackQueries.map(packQuery),
          strategy: 'none'
        })
        const hits = (results as SearchResponse<AlgoliaNodePack>[]).flatMap(
          (result) => result.hits
        )
        return uniqBy(hits, (hit) => hit.objectID).slice(0, pageSize)
      } catch (error) {
        reportError(error, {
          errorType: 'error_searching_algolia_fallbacks',
          surface: 'platform',
          level: 'warning',
          tags: { outcome: 'degraded' }
        })
        return undefined
      }
    }

    const shouldQuerySuggestions =
      query.length >= MIN_CHARS_FOR_SUGGESTIONS_ALGOLIA
    const requests: SearchQuery[] = [packQuery(query)]
    if (shouldQuerySuggestions) {
      requests.push({
        indexName: 'nodes_index_query_suggestions',
        query
      })
    }

    const { results } = await searchClient.search<
      AlgoliaNodePack | NodesIndexSuggestion
    >({
      requests,
      strategy: 'none'
    })

    const nodePacks = results[0] as SearchResponse<AlgoliaNodePack>
    const querySuggestions = results[1] as
      | SearchResponse<NodesIndexSuggestion>
      | undefined

    const isNodeSearch =
      params.restrictSearchableAttributes?.includes('comfy_nodes')
    const needsFallbacks =
      pageNumber === 0 && !isNodeSearch && nodePacks.hits.length === 0
    const hits = needsFallbacks
      ? await searchFallbacks(buildPackSearchFallbacks(query))
      : nodePacks.hits

    const registryPacks = (hits ?? []).map(toRegistryPack)

    const suggestions =
      querySuggestions?.hits.map((suggestion) => ({
        query: suggestion.query,
        popularity: suggestion.popularity
      })) ?? []

    return {
      result: {
        nodePacks: registryPacks,
        querySuggestions: suggestions,
        hasMore:
          nodePacks.nbPages === undefined
            ? undefined
            : pageNumber + 1 < nodePacks.nbPages,
        rawResultsEmpty: nodePacks.hits.length === 0
      },
      fallbacksFailed: hits === undefined
    }
  }

  const searchPacks = async (
    query: string,
    params: SearchNodePacksParams
  ): Promise<SearchPacksResult> => {
    const cacheKey = paramsToCacheKey({ query, ...params })
    const cachedResult = searchPacksCache.get(cacheKey)
    if (cachedResult !== undefined) return cachedResult

    const { result, fallbacksFailed } = await searchPacksInternal(query, params)
    if (!fallbacksFailed) searchPacksCache.set(cacheKey, result)
    return result
  }

  const clearSearchCache = () => {
    searchPacksCache.clear()
  }

  return {
    searchPacks,
    clearSearchCache
  }
}
