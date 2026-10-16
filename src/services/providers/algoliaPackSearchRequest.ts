import type { SearchQuery } from 'algoliasearch/dist/lite/browser'

import type {
  SearchAttribute,
  SearchNodePacksParams
} from '@/types/algoliaTypes'

export const PACK_SEARCHABLE_ATTRIBUTES: SearchAttribute[] = [
  'name',
  'description'
]

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

/**
 * The nodes_index request for one pack search query. Kept free of runtime
 * imports so the fixture recorder script can send the same request.
 */
export function buildPackSearchRequest(
  query: string,
  params: SearchNodePacksParams,
  extraAnalyticsTag?: string
): SearchQuery {
  const { pageSize, pageNumber, ...rest } = params
  return {
    query,
    indexName: 'nodes_index',
    attributesToRetrieve: RETRIEVE_ATTRIBUTES,
    ...rest,
    ...(extraAnalyticsTag !== undefined && {
      analyticsTags: [...(rest.analyticsTags ?? []), extraAnalyticsTag]
    }),
    hitsPerPage: pageSize,
    page: pageNumber
  }
}
