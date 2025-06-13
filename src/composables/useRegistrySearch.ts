import { watchDebounced } from '@vueuse/core'
import type { Hit } from 'algoliasearch/dist/lite/browser'
import { memoize, orderBy } from 'lodash'
import { computed, onUnmounted, ref, watch } from 'vue'

import { useAlgoliaSearchService } from '@/services/algoliaSearchService'
import type {
  AlgoliaNodePack,
  NodesIndexSuggestion,
  SearchAttribute
} from '@/types/algoliaTypes'
import { SortableAlgoliaField } from '@/types/comfyManagerTypes'

const SEARCH_DEBOUNCE_TIME = 320
const DEFAULT_PAGE_SIZE = 64
const DEFAULT_SORT_FIELD = SortableAlgoliaField.Downloads // Set in the index configuration
const DEFAULT_MAX_CACHE_SIZE = 64
const SORT_DIRECTIONS: Record<SortableAlgoliaField, 'asc' | 'desc'> = {
  [SortableAlgoliaField.Downloads]: 'desc',
  [SortableAlgoliaField.Created]: 'desc',
  [SortableAlgoliaField.Updated]: 'desc',
  [SortableAlgoliaField.Publisher]: 'asc',
  [SortableAlgoliaField.Name]: 'asc'
}

const isDateField = (field: SortableAlgoliaField): boolean =>
  field === SortableAlgoliaField.Created ||
  field === SortableAlgoliaField.Updated

/**
 * Composable for managing UI state of Comfy Node Registry search.
 */
export function useRegistrySearch(
  options: {
    maxCacheSize?: number
  } = {}
) {
  const { maxCacheSize = DEFAULT_MAX_CACHE_SIZE } = options
  const isLoading = ref(false)
  const sortField = ref<SortableAlgoliaField>(SortableAlgoliaField.Downloads)
  const searchMode = ref<'nodes' | 'packs'>('packs')
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const pageNumber = ref(0)
  const searchQuery = ref('')
  const results = ref<AlgoliaNodePack[]>([])
  const suggestions = ref<NodesIndexSuggestion[]>([])

  const searchAttributes = computed<SearchAttribute[]>(() =>
    searchMode.value === 'nodes' ? ['comfy_nodes'] : ['name', 'description']
  )

  const resultsAsRegistryPacks = computed(() =>
    results.value ? results.value.map(algoliaToRegistry) : []
  )
  const resultsAsNodes = computed(() =>
    results.value
      ? results.value.reduce(
          (acc, hit) => acc.concat(hit.comfy_nodes),
          [] as string[]
        )
      : []
  )

  const { searchPacksCached, toRegistryPack, clearSearchPacksCache } =
    useAlgoliaSearchService({
      maxCacheSize
    })

  const algoliaToRegistry = memoize(
    toRegistryPack,
    (algoliaNode: AlgoliaNodePack) => algoliaNode.id
  )
  const getSortValue = (pack: Hit<AlgoliaNodePack>) => {
    if (isDateField(sortField.value)) {
      const value = pack[sortField.value]
      return value ? new Date(value).getTime() : 0
    } else {
      const value = pack[sortField.value]
      return value ?? 0
    }
  }

  const updateSearchResults = async (options: { append?: boolean }) => {
    isLoading.value = true
    if (!options.append) {
      pageNumber.value = 0
    }
    const { nodePacks, querySuggestions } = await searchPacksCached(
      searchQuery.value,
      {
        pageSize: pageSize.value,
        pageNumber: pageNumber.value,
        restrictSearchableAttributes: searchAttributes.value
      }
    )

    let sortedPacks = nodePacks

    // Results are sorted by the default field to begin with -- so don't manually sort again
    if (sortField.value && sortField.value !== DEFAULT_SORT_FIELD) {
      sortedPacks = orderBy(
        nodePacks,
        [getSortValue],
        [SORT_DIRECTIONS[sortField.value]]
      )
    }

    if (options.append && results.value?.length) {
      results.value = results.value.concat(sortedPacks)
    } else {
      results.value = sortedPacks
    }
    suggestions.value = querySuggestions
    isLoading.value = false
  }

  const onQueryChange = () => updateSearchResults({ append: false })
  const onPageChange = () => updateSearchResults({ append: true })

  watch([sortField, searchMode], onQueryChange)
  watch(pageNumber, onPageChange)
  watchDebounced(searchQuery, onQueryChange, {
    debounce: SEARCH_DEBOUNCE_TIME,
    immediate: true
  })

  onUnmounted(clearSearchPacksCache)

  return {
    isLoading,
    pageNumber,
    pageSize,
    sortField,
    searchMode,
    searchQuery,
    suggestions,
    searchResults: resultsAsRegistryPacks,
    nodeSearchResults: resultsAsNodes
  }
}
