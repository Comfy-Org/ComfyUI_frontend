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
  searchMode: SearchMode
  rawResultsEmpty: boolean
}

type PageLoadOutcome = 'loaded' | 'inputsChanged'

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
   * The query and mode behind the shown first page and its outcome; null
   * while that page loads or after it failed.
   */
  firstPage: Readonly<Ref<SearchedFirstPage | null>>
  /** Whether the search for the first page failed; false while it loads. */
  searchFailed: Readonly<Ref<boolean>>
} {
  const { searchPacks } = useRegistrySearchGateway()

  let pageNumber = 0
  const items = ref<RegistryNodePack[]>([])
  const morePages = ref(true)
  const suggestions = ref<QuerySuggestion[]>([])
  const firstPage = ref<SearchedFirstPage | null>(null)
  const searchFailed = ref(false)
  const { enqueue, preempt, running: isLoading } = usePreemptableQueue()
  const searchedQuery = () => toValue(inputs.query).trim()

  const searchableAttributes = (searchMode: SearchMode): SearchAttribute[] =>
    searchMode === 'nodes' ? ['comfy_nodes'] : [...PACK_SEARCHABLE_ATTRIBUTES]

  function analyticsParams(
    query: string
  ): Pick<SearchNodePacksParams, 'analyticsTags'> {
    const isTypedSearch =
      pageNumber === 0 &&
      query !== '' &&
      (toValue(inputs.isTypedQuery) ?? false)
    return isTypedSearch ? { analyticsTags: [USER_SEARCH_ANALYTICS_TAG] } : {}
  }

  async function doLoadMore(): Promise<PageLoadOutcome> {
    if (!morePages.value) return 'loaded'
    const query = searchedQuery()
    const searchMode = toValue(inputs.searchMode)
    const isCurrent = () =>
      query === searchedQuery() && searchMode === toValue(inputs.searchMode)
    try {
      const result = await searchPacks(query, {
        pageSize: DEFAULT_PAGE_SIZE,
        pageNumber,
        restrictSearchableAttributes: searchableAttributes(searchMode),
        ...analyticsParams(query)
      })
      if (!isCurrent()) return 'inputsChanged'
      const { nodePacks } = result
      morePages.value = result.hasMore ?? nodePacks.length >= DEFAULT_PAGE_SIZE
      if (pageNumber === 0) {
        firstPage.value = {
          query,
          searchMode,
          rawResultsEmpty: result.rawResultsEmpty ?? nodePacks.length === 0
        }
      }
      items.value.push(...nodePacks)
      suggestions.value = result.querySuggestions
      pageNumber++
    } catch (error) {
      if (!isCurrent()) return 'inputsChanged'
      reportError(error, {
        errorType: 'error_searching_registry_packs',
        surface: 'platform',
        level: 'warning',
        tags: { outcome: 'degraded' }
      })
      morePages.value = false
      if (pageNumber === 0) {
        searchFailed.value = true
        suggestions.value = []
      }
    }
    return 'loaded'
  }

  const reload = () =>
    preempt(async () => {
      do {
        pageNumber = 0
        morePages.value = true
        firstPage.value = null
        searchFailed.value = false
        items.value = []
      } while ((await doLoadMore()) === 'inputsChanged')
    })

  async function loadMore() {
    const startingPage = pageNumber
    await enqueue('loadMore', async () => {
      await doLoadMore()
    })
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
    firstPage,
    searchFailed
  }
}
