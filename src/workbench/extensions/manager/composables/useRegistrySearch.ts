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

type FirstPage =
  | { status: 'loading' }
  | { status: 'failed'; query: string }
  | { status: 'loaded'; query: string; rawResultsEmpty: boolean }

const LOADING_FIRST_PAGE: FirstPage = { status: 'loading' }

type PageFreshness = 'current' | 'stale'

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
   * The first page for the current inputs: loading from an input change
   * until its search settles, then the query it searched and its outcome.
   */
  firstPage: Readonly<Ref<FirstPage>>
} {
  const { searchPacks } = useRegistrySearchGateway()

  let pageNumber = 0
  let failureReportedSinceSuccess = false
  const items = ref<RegistryNodePack[]>([])
  const morePages = ref(true)
  const suggestions = ref<QuerySuggestion[]>([])
  const firstPage = ref<FirstPage>(LOADING_FIRST_PAGE)
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

  function reportFirstFailureSinceSuccess(error: unknown) {
    if (failureReportedSinceSuccess) return
    failureReportedSinceSuccess = true
    reportError(error, {
      errorType: 'error_searching_registry_packs',
      surface: 'platform',
      level: 'warning',
      tags: { outcome: 'degraded' }
    })
  }

  async function doLoadMore(): Promise<PageFreshness> {
    if (!morePages.value) return 'current'
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
      if (!isCurrent()) return 'stale'
      failureReportedSinceSuccess = false
      const { nodePacks } = result
      morePages.value = result.hasMore ?? nodePacks.length >= DEFAULT_PAGE_SIZE
      if (pageNumber === 0) {
        firstPage.value = {
          status: 'loaded',
          query,
          rawResultsEmpty: result.rawResultsEmpty ?? nodePacks.length === 0
        }
      }
      items.value.push(...nodePacks)
      suggestions.value = result.querySuggestions
      pageNumber++
    } catch (error) {
      if (!isCurrent()) return 'stale'
      reportFirstFailureSinceSuccess(error)
      morePages.value = false
      if (pageNumber === 0) {
        firstPage.value = { status: 'failed', query }
        suggestions.value = []
      }
    }
    return 'current'
  }

  const reload = () =>
    preempt(async () => {
      do {
        pageNumber = 0
        morePages.value = true
        firstPage.value = LOADING_FIRST_PAGE
        items.value = []
      } while ((await doLoadMore()) === 'stale')
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
    () => {
      firstPage.value = LOADING_FIRST_PAGE
      items.value = []
      void reload()
    },
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
