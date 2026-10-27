import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
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
import type {
  QuerySuggestion,
  SearchMode,
  SearchPacksResult
} from '@/types/searchServiceTypes'
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
 * Offset-paged registry search as a {@link PagedList} that reloads from the
 * first page whenever its inputs change.
 */
export function useRegistrySearch(inputs: {
  query: MaybeRefOrGetter<string>
  searchMode: MaybeRefOrGetter<SearchMode>
  /** Whether the query came from the user typing, for analytics tagging. */
  isTypedQuery?: MaybeRefOrGetter<boolean>
  /** Whether the results are on screen; only on-screen failures are reported. */
  isVisible?: MaybeRefOrGetter<boolean>
}): PagedList<RegistryNodePack> & {
  suggestions: Readonly<Ref<QuerySuggestion[]>>
  /**
   * The first page for the current inputs: loading from an input change
   * until its search settles, then the query it searched and its outcome.
   */
  firstPage: Readonly<Ref<FirstPage>>
  /** Whether the page after the loaded ones failed and waits for a retry. */
  isNextPageFailed: Readonly<Ref<boolean>>
  /** Loads the failed next page again for the same search. */
  retryNextPage: () => Promise<boolean>
} {
  const { searchPacks, resetCircuits } = useRegistrySearchGateway()

  let pageNumber = 0
  let generation = 0
  let failureReportedSinceSuccess = false
  let isDisposed = false
  const items = ref<RegistryNodePack[]>([])
  const morePages = ref(true)
  const isNextPageFailed = ref(false)
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

  function reportFirstFailureSinceSuccess(cause: unknown) {
    if (failureReportedSinceSuccess || !(toValue(inputs.isVisible) ?? true)) {
      return
    }
    failureReportedSinceSuccess = true
    reportError(cause, {
      errorType: 'error_searching_registry_packs',
      surface: 'platform',
      level: 'warning',
      tags: { outcome: 'degraded' }
    })
  }

  function applyPage(query: string, result: SearchPacksResult) {
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
  }

  function applyFailure(query: string, cause: unknown) {
    reportFirstFailureSinceSuccess(cause)
    if (pageNumber > 0) {
      isNextPageFailed.value = true
      return
    }
    morePages.value = false
    firstPage.value = { status: 'failed', query }
    suggestions.value = []
  }

  async function doLoadMore(): Promise<PageFreshness> {
    if (!morePages.value || isNextPageFailed.value) return 'current'
    const requestGeneration = generation
    const query = searchedQuery()
    const outcome = await searchPacks(query, {
      pageSize: DEFAULT_PAGE_SIZE,
      pageNumber,
      restrictSearchableAttributes: searchableAttributes(
        toValue(inputs.searchMode)
      ),
      ...analyticsParams(query)
    })
    if (outcome.ok) failureReportedSinceSuccess = false
    if (isDisposed || requestGeneration !== generation) return 'stale'
    if (outcome.ok) applyPage(query, outcome.result)
    else applyFailure(query, outcome.cause)
    return 'current'
  }

  async function loadCurrentFirstPage(): Promise<void> {
    if ((await doLoadMore()) === 'stale' && !isDisposed) {
      return loadCurrentFirstPage()
    }
  }

  function reload() {
    generation++
    pageNumber = 0
    morePages.value = true
    isNextPageFailed.value = false
    firstPage.value = LOADING_FIRST_PAGE
    items.value = []
    return preempt(loadCurrentFirstPage)
  }

  async function loadMore() {
    const startingPage = pageNumber
    await enqueue('loadMore', async () => {
      await doLoadMore()
    })
    return pageNumber > startingPage
  }

  function retry() {
    resetCircuits()
    return reload()
  }

  async function retryNextPage() {
    if (!isNextPageFailed.value) return false
    resetCircuits()
    isNextPageFailed.value = false
    return loadMore()
  }

  onScopeDispose(() => {
    isDisposed = true
  }, true)

  watch(
    [searchedQuery, () => toValue(inputs.searchMode)],
    () => void reload(),
    {
      immediate: true
    }
  )

  return {
    items,
    hasMore: computed(() => morePages.value && !isNextPageFailed.value),
    isLoading,
    loadMore,
    loadNew: retry,
    invalidate: reload,
    suggestions,
    firstPage,
    isNextPageFailed,
    retryNextPage
  }
}
