import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'

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
}

type SearchAttribute = keyof AlgoliaNodePack

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

export const useAlgoliaSearchService = () => {
  const searchClient = algoliasearch(__ALGOLIA_APP_ID__, __ALGOLIA_API_KEY__)

  const searchPacks = async (
    query: string,
    {
      pageSize,
      pageNumber,
      restrictSearchableAttributes
    }: {
      pageSize: number
      pageNumber: number
      restrictSearchableAttributes: string[]
    }
  ) => {
    const { results } = await searchClient.search<AlgoliaNodePack>([
      {
        indexName: 'nodes_index',
        params: {
          query,
          hitsPerPage: pageSize,
          page: pageNumber,
          length: pageSize,
          attributesToRetrieve: RETRIEVE_ATTRIBUTES,
          restrictSearchableAttributes
        }
      }
    ])

    // @ts-expect-error module needs
    return results[0].hits
  }

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

  function toRegistryPack(algoliaNode: AlgoliaNodePack): RegistryNodePack {
    return {
      id: algoliaNode.id ?? algoliaNode.objectID,
      name: algoliaNode.name,
      description: algoliaNode.description,
      repository: algoliaNode.repository_url,
      license: algoliaNode.license,
      downloads: algoliaNode.total_install,
      status: algoliaNode.status,
      latest_version: toRegistryLatestVersion(algoliaNode),
      publisher: toRegistryPublisher(algoliaNode)
    }
  }

  return {
    searchPacks,
    toRegistryPack
  }
}
