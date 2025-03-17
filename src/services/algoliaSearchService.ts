import type {
  BaseSearchParamsWithoutQuery,
  Hit,
  SearchResponse
} from 'algoliasearch/dist/lite/browser'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import { omit } from 'lodash'

import { components } from '@/types/comfyRegistryTypes'

declare const __ALGOLIA_APP_ID__: string
declare const __ALGOLIA_API_KEY__: string

type SafeNestedProperty<
  T,
  K1 extends keyof T,
  K2 extends keyof NonNullable<T[K1]>
> = T[K1] extends undefined | null ? undefined : NonNullable<T[K1]>[K2]

type RegistryNodePack = components['schemas']['Node']

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
  /** `total_install` index only */
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
  'update_time',
  'license',
  'repository_url',
  'latest_version_status',
  'comfy_node_extract_status',
  'id'
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

export const useAlgoliaSearchService = () => {
  const searchClient = algoliasearch(__ALGOLIA_APP_ID__, __ALGOLIA_API_KEY__)

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
  ): Promise<{
    nodePacks: Hit<AlgoliaNodePack>[]
    querySuggestions: Hit<NodesIndexSuggestion>[]
  }> => {
    const { pageSize, pageNumber } = params
    const rest = omit(params, ['pageSize', 'pageNumber'])

    const { results } = await searchClient.search<
      AlgoliaNodePack | NodesIndexSuggestion
    >({
      requests: [
        {
          query,
          indexName: 'nodes_index',
          attributesToRetrieve: RETRIEVE_ATTRIBUTES,
          ...rest,
          hitsPerPage: pageSize,
          page: pageNumber
        },
        {
          indexName: 'nodes_index_query_suggestions',
          query
        }
      ],
      strategy: 'none'
    })

    const [nodePacks, querySuggestions] = results as [
      SearchResponse<AlgoliaNodePack>,
      SearchResponse<NodesIndexSuggestion>
    ]

    return {
      nodePacks: nodePacks.hits,
      querySuggestions: querySuggestions.hits
    }
  }

  return {
    searchPacks,
    toRegistryPack
  }
}
