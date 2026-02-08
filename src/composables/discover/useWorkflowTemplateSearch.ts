import type { SearchResponse } from 'algoliasearch/dist/lite/browser'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import { ref } from 'vue'

import type {
  AlgoliaWorkflowTemplate,
  WorkflowTemplateSearchParams,
  WorkflowTemplateSearchResult
} from '@/types/discoverTypes'

const ALGOLIA_APP_ID = 'CSTOFZ5FPH'
const ALGOLIA_SEARCH_KEY = 'bbb304247bd251791b8653e9a816b322'
const INDEX_NAME = 'workflow_templates'

const RETRIEVE_ATTRIBUTES = [
  'objectID',
  'name',
  'title',
  'description',
  'thumbnail_url',
  'thumbnail_urls',
  'thumbnail_count',
  'thumbnail_variant',
  'media_type',
  'media_subtype',
  'tags',
  'models',
  'open_source',
  'requires_custom_nodes',
  'author_name',
  'author_avatar_url',
  'run_count',
  'view_count',
  'copy_count',
  'workflow_url'
] as const

export function useWorkflowTemplateSearch() {
  const searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY)

  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const results = ref<WorkflowTemplateSearchResult | null>(null)

  async function search(
    params: WorkflowTemplateSearchParams
  ): Promise<WorkflowTemplateSearchResult> {
    isLoading.value = true
    error.value = null

    try {
      const response = await searchClient.search<AlgoliaWorkflowTemplate>({
        requests: [
          {
            indexName: INDEX_NAME,
            query: params.query,
            attributesToRetrieve: [...RETRIEVE_ATTRIBUTES],
            hitsPerPage: params.pageSize,
            page: params.pageNumber,
            filters: params.filters,
            facetFilters: params.facetFilters,
            facets: ['tags', 'models', 'media_type', 'open_source']
          }
        ]
      })

      const searchResponse = response
        .results[0] as SearchResponse<AlgoliaWorkflowTemplate>

      const result: WorkflowTemplateSearchResult = {
        templates: searchResponse.hits,
        totalHits: searchResponse.nbHits ?? 0,
        totalPages: searchResponse.nbPages ?? 0,
        page: searchResponse.page ?? 0,
        facets: searchResponse.facets
      }

      results.value = result
      return result
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      throw error.value
    } finally {
      isLoading.value = false
    }
  }

  function clearResults() {
    results.value = null
    error.value = null
  }

  return {
    search,
    clearResults,
    isLoading,
    error,
    results
  }
}
