import type {
  BaseSearchParamsWithoutQuery,
  Hit
} from 'algoliasearch/dist/lite/browser'

import type { components } from '@/types/comfyRegistryTypes'

type SafeNestedProperty<
  T,
  K1 extends keyof T,
  K2 extends keyof NonNullable<T[K1]>
> = T[K1] extends undefined | null ? undefined : NonNullable<T[K1]>[K2]

type RegistryNodePack = components['schemas']['Node']
export type SearchPacksResult = {
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

export type SearchNodePacksParams = BaseSearchParamsWithoutQuery & {
  pageSize: number
  pageNumber: number
  restrictSearchableAttributes: SearchAttribute[]
}
