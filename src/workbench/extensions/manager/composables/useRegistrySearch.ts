import { computed, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

import { DEFAULT_PAGE_SIZE } from '@/constants/searchConstants'
import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import type { SearchAttribute } from '@/types/algoliaTypes'
import type { components } from '@/types/comfyRegistryTypes'
import type { QuerySuggestion, SearchMode } from '@/types/searchServiceTypes'
import { usePreemptableQueue } from '@/utils/pagedList'
import type { PagedList } from '@/utils/pagedList'

type RegistryNodePack = components['schemas']['Node']

/**
 * Offset-paged registry search as a {@link PagedList}. Query inputs are reactive
 * so a change resets and reloads from the first page. A relevance-ranked index
 * has no head cursor and no per-item staleness, so `loadNew`/`invalidate` both
 * reduce to reloading from the first page.
 */
export function useRegistrySearch(inputs: {
  query: MaybeRefOrGetter<string>
  searchMode: MaybeRefOrGetter<SearchMode>
}): PagedList<RegistryNodePack> & {
  suggestions: Readonly<Ref<QuerySuggestion[]>>
  rawResultsEmpty: Readonly<Ref<boolean>>
} {
  const { searchPacks } = useRegistrySearchGateway()

  let pageNumber = 0
  const items = ref<RegistryNodePack[]>([])
  const morePages = ref(true)
  const suggestions = ref<QuerySuggestion[]>([])
  const rawResultsEmpty = ref(false)
  const { enqueue, preempt, running: isLoading } = usePreemptableQueue()

  const searchableAttributes = (): SearchAttribute[] =>
    toValue(inputs.searchMode) === 'nodes'
      ? ['comfy_nodes']
      : ['name', 'description']

  async function doLoadMore() {
    if (!morePages.value) return
    try {
      const result = await searchPacks(toValue(inputs.query), {
        pageSize: DEFAULT_PAGE_SIZE,
        pageNumber,
        restrictSearchableAttributes: searchableAttributes()
      })
      const { nodePacks } = result
      morePages.value = result.hasMore ?? nodePacks.length >= DEFAULT_PAGE_SIZE
      if (pageNumber === 0)
        rawResultsEmpty.value = result.rawResultsEmpty ?? nodePacks.length === 0
      items.value.push(...nodePacks)
      suggestions.value = result.querySuggestions
      pageNumber++
    } catch (err) {
      console.error(err)
      morePages.value = false
    }
  }

  const reload = () =>
    preempt(async () => {
      pageNumber = 0
      morePages.value = true
      rawResultsEmpty.value = false
      items.value = []
      await doLoadMore()
    })

  async function loadMore() {
    const startingPage = pageNumber
    await enqueue('loadMore', doLoadMore)
    return pageNumber > startingPage
  }

  watch(
    () => [toValue(inputs.query), toValue(inputs.searchMode)],
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
    rawResultsEmpty
  }
}
