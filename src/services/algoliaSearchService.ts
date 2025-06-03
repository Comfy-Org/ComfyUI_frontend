import QuickLRU from '@alloc/quick-lru'
import type {
  BaseSearchParamsWithoutQuery,
  Hit,
  SearchQuery,
  SearchResponse
} from 'algoliasearch/dist/lite/browser'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import { omit } from 'lodash'

import { components } from '@/types/comfyRegistryTypes'
import { paramsToCacheKey } from '@/utils/formatUtil'

const DEFAULT_MAX_CACHE_SIZE = 64
const DEFAULT_MIN_CHARS_FOR_SUGGESTIONS = 2

type SafeNestedProperty<
  T,
  K1 extends keyof T,
  K2 extends keyof NonNullable<T[K1]>
> = T[K1] extends undefined | null ? undefined : NonNullable<T[K1]>[K2]

type RegistryNodePack = components['schemas']['Node']
type SearchPacksResult = {
  nodePacks: Hit<AlgoliaNodePack>[]
  querySuggestions: Hit<NodesIndexSuggestion>[]
}

export interface AlgoliaNodePack {
  objectID: RegistryNodePack['id']
  name: RegistryNodePack['name']
  publisher_id: SafeNestedProperty<RegistryNodePack, 'publisher', 'id'>
  description: RegistryNodePack['description']
  comfy_nodes: string[]
  total_install: RegistryNodePack['downloads']
  id: RegistryNodePack['id']
  create_time: string
  update_time: SafeNestedProperty<
    RegistryNodePack,
    'latest_version',
    'createdAt'
  >
  license: RegistryNodePack['license']
  repository_url: RegistryNodePack['repository']
  status: RegistryNodePack['status']
  latest_version: SafeNestedProperty<
    RegistryNodePack,
    'latest_version',
    'version'
  >
  latest_version_status: SafeNestedProperty<
    RegistryNodePack,
    'latest_version',
    'status'
  >
  comfy_node_extract_status: SafeNestedProperty<
    RegistryNodePack,
    'latest_version',
    'comfy_node_extract_status'
  >
  icon_url: RegistryNodePack['icon']
}

export type SearchAttribute = keyof AlgoliaNodePack

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
  'icon_url'
]

export interface NodesIndexSuggestion {
  nb_words: number
  nodes_index: {
    exact_nb_hits: number
    facets: {
      exact_matches: Record<string, number>
      analytics: Record<string, any>
    }
  }
  objectID: RegistryNodePack['id']
  popularity: number
  query: string
}

type SearchNodePacksParams = BaseSearchParamsWithoutQuery & {
  pageSize: number
  pageNumber: number
  restrictSearchableAttributes: SearchAttribute[]
}

interface AlgoliaSearchServiceOptions {
  /**
   * Maximum number of search results to store in the cache.
   * The cache is automatically cleared when the component is unmounted.
   * @default 64
   */
  maxCacheSize?: number
  /**
   * Minimum number of characters for suggestions. An additional query
   * will be made to the suggestions/completions index for queries that
   * are this length or longer.
   * @default 3
   */
  minCharsForSuggestions?: number
}

export const useAlgoliaSearchService = (
  options: AlgoliaSearchServiceOptions = {}
) => {
  const {
    maxCacheSize = DEFAULT_MAX_CACHE_SIZE,
    minCharsForSuggestions = DEFAULT_MIN_CHARS_FOR_SUGGESTIONS
  } = options
  const searchClient = algoliasearch(__ALGOLIA_APP_ID__, __ALGOLIA_API_KEY__, {
    hosts: [
      {
        url: 'search.comfy.org/api/search',
        accept: 'read',
        protocol: 'https'
      }
    ],
    baseHeaders: {
      'X-Algolia-Application-Id': __ALGOLIA_APP_ID__,
      'X-Algolia-API-Key': __ALGOLIA_API_KEY__
    }
  })
  const searchPacksCache = new QuickLRU<string, SearchPacksResult>({
    maxSize: maxCacheSize
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
  function toRegistryPack(algoliaNode: AlgoliaNodePack): RegistryNodePack {
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
      // @ts-expect-error remove when comfy_nodes is added to node (pack) info
      comfy_nodes: algoliaNode.comfy_nodes
    }
  }

  /**
   * Search for node packs in Algolia
   */
  const searchPacks = async (
    query: string,
    params: SearchNodePacksParams
  ): Promise<SearchPacksResult> => {
    const { pageSize, pageNumber } = params
    const rest = omit(params, ['pageSize', 'pageNumber'])

    const requests: SearchQuery[] = [
      {
        query,
        indexName: 'nodes_index',
        attributesToRetrieve: RETRIEVE_ATTRIBUTES,
        ...rest,
        hitsPerPage: pageSize,
        page: pageNumber
      }
    ]

    const shouldQuerySuggestions = query.length >= minCharsForSuggestions

    // If the query is long enough, also query the suggestions index
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

    const [nodePacks, querySuggestions = { hits: [] }] = results as [
      SearchResponse<AlgoliaNodePack>,
      SearchResponse<NodesIndexSuggestion>
    ]

    return {
      nodePacks: nodePacks.hits,
      querySuggestions: querySuggestions.hits
    }
  }

  const searchPacksCached = async (
    query: string,
    params: SearchNodePacksParams
  ): Promise<SearchPacksResult> => {
    const cacheKey = paramsToCacheKey({ query, ...params })
    const cachedResult = searchPacksCache.get(cacheKey)
    if (cachedResult !== undefined) return cachedResult

    const result = await searchPacks(query, params)
    searchPacksCache.set(cacheKey, result)
    return result
  }

  const clearSearchPacksCache = () => {
    searchPacksCache.clear()
  }

  return {
    searchPacks,
    searchPacksCached,
    toRegistryPack,
    clearSearchPacksCache
  }
}
