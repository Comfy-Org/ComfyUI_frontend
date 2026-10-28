import type { SearchQuery } from 'algoliasearch/dist/lite/browser'

import type {
  SearchAttribute,
  SearchNodePacksParams
} from '@/types/algoliaTypes'

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

/** The nodes_index request for one pack search query. */
export function buildPackSearchRequest(
  query: string,
  params: SearchNodePacksParams
): SearchQuery {
  const { pageSize, pageNumber, ...rest } = params
  return {
    query,
    indexName: 'nodes_index',
    attributesToRetrieve: RETRIEVE_ATTRIBUTES,
    ...rest,
    hitsPerPage: pageSize,
    page: pageNumber
  }
}
