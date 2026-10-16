import { computed, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

import {
  DEFAULT_PAGE_SIZE,
  PACK_SEARCHABLE_ATTRIBUTES,
  USER_SEARCH_ANALYTICS_TAG
} from '@/constants/searchConstants'
import { reportError } from '@/platform/telemetry/reportError'
import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import type {
  SearchAttribute,
  SearchNodePacksParams
} from '@/types/algoliaTypes'
import type { components } from '@/types/comfyRegistryTypes'
import type { QuerySuggestion, SearchMode } from '@/types/searchServiceTypes'
import { usePreemptableQueue } from '@/utils/pagedList'
import type { PagedList } from '@/utils/pagedList'

type RegistryNodePack = components['schemas']['Node']

interface SearchedFirstPage {
  query: string
  rawResultsEmpty: boolean
}

/**
 * Offset-paged registry search as a {@link PagedList}. Query inputs are reactive
 * so a change resets and reloads from the first page. A relevance-ranked index
 * has no head cursor and no per-item staleness, so `loadNew`/`invalidate` both
 * reduce to reloading from the first page.
 */
export function useRegistrySearch(inputs: {
  query: MaybeRefOrGetter<string>
  searchMode: MaybeRefOrGetter<SearchMode>
  /** Whether the query came from the user typing, for analytics tagging. */
  isTypedQuery?: MaybeRefOrGetter<boolean>
}): PagedList<RegistryNodePack> & {
  suggestions: Readonly<Ref<QuerySuggestion[]>>
  /**
   * The query behind the shown first page and its outcome; null while that
   * page loads or after it failed.
   */
  firstPage: Readonly<Ref<SearchedFirstPage | null>>
} {
  const { searchPacks } = useRegistrySearchGateway()

  let pageNumber = 0
  const items = ref<RegistryNodePack[]>([])
  const morePages = ref(true)
  const suggestions = ref<QuerySuggestion[]>([])
  const firstPage = ref<SearchedFirstPage | null>(null)
  const { enqueue, preempt, running: isLoading } = usePreemptableQueue()
  const searchedQuery = () => toValue(inputs.query).trim()

  const searchableAttributes = (): SearchAttribute[] =>
    toValue(inputs.searchMode) === 'nodes'
      ? ['comfy_nodes']
      : [...PACK_SEARCHABLE_ATTRIBUTES]

  function analyticsParams(
    query: string
  ): Pick<SearchNodePacksParams, 'analyticsTags'> {
    const isTypedSearch =
      pageNumber === 0 &&
      query !== '' &&
      (toValue(inputs.isTypedQuery) ?? false)
    return isTypedSearch ? { analyticsTags: [USER_SEARCH_ANALYTICS_TAG] } : {}
  }

  async function doLoadMore() {
    if (!morePages.value) return
    const query = searchedQuery()
    try {
      const result = await searchPacks(query, {
        pageSize: DEFAULT_PAGE_SIZE,
        pageNumber,
        restrictSearchableAttributes: searchableAttributes(),
        ...analyticsParams(query)
      })
      const { nodePacks } = result
      morePages.value = result.hasMore ?? nodePacks.length >= DEFAULT_PAGE_SIZE
      if (pageNumber === 0) {
        firstPage.value = {
          query,
          rawResultsEmpty: result.rawResultsEmpty ?? nodePacks.length === 0
        }
      }
      items.value.push(...nodePacks)
      suggestions.value = result.querySuggestions
      pageNumber++
    } catch (error) {
      reportError(error, {
        errorType: 'error_searching_registry_packs',
        surface: 'platform'
      })
      morePages.value = false
    }
  }

  const reload = () =>
    preempt(async () => {
      pageNumber = 0
      morePages.value = true
      firstPage.value = null
      items.value = []
      await doLoadMore()
    })

  async function loadMore() {
    const startingPage = pageNumber
    await enqueue('loadMore', doLoadMore)
    return pageNumber > startingPage
  }

  watch(
    [searchedQuery, () => toValue(inputs.searchMode)],
    () => void reload(),
    { immediate: true }
  )

  return {
    items,
    hasMore: computed(() => morePages.value),
    isLoading,
    loadMore,
    loadNew: reload,
    invalidate: reload,
    suggestions,
    firstPage
  }
}
