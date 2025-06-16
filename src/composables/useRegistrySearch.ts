import { watchDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { DEFAULT_PAGE_SIZE } from '@/constants/searchConstants'
import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import type { SearchAttribute } from '@/types/algoliaTypes'
import type { components } from '@/types/comfyRegistryTypes'
import type {
  ActiveFilters,
  QuerySuggestion,
  SearchMode
} from '@/types/searchServiceTypes'

type RegistryNodePack = components['schemas']['Node']

const SEARCH_DEBOUNCE_TIME = 320
const DEFAULT_SORT_FIELD = 'total_install' // Downloads field in the database

/**
 * Composable for managing UI state of Comfy Node Registry search.
 */
export function useRegistrySearch(
  options: {
    initialSortField?: string
    initialSearchMode?: SearchMode
    initialSearchQuery?: string
    initialPageNumber?: number
  } = {}
) {
  const {
    initialSortField = DEFAULT_SORT_FIELD,
    initialSearchMode = 'packs',
    initialSearchQuery = '',
    initialPageNumber = 0
  } = options

  const isLoading = ref(false)
  const sortField = ref<string>(initialSortField)
  const searchMode = ref<SearchMode>(initialSearchMode)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const pageNumber = ref(initialPageNumber)
  const searchQuery = ref(initialSearchQuery)
  const searchResults = ref<RegistryNodePack[]>([])
  const suggestions = ref<QuerySuggestion[]>([])
  const activeFilters = ref<ActiveFilters>({})

  const searchAttributes = computed<SearchAttribute[]>(() =>
    searchMode.value === 'nodes' ? ['comfy_nodes'] : ['name', 'description']
  )

  const searchGateway = useRegistrySearchGateway()

  const {
    searchPacks,
    clearSearchCache,
    getSortableFields,
    getFilterableFields
  } = searchGateway

  const updateSearchResults = async (options: { append?: boolean }) => {
    isLoading.value = true
    if (!options.append) {
      pageNumber.value = 0
    }

    // Get the sort direction from the provider's sortable fields
    const sortableFields = getSortableFields()
    const fieldConfig = sortableFields.find((f) => f.id === sortField.value)
    const sortDirection = fieldConfig?.direction || 'desc'

    const { nodePacks, querySuggestions } = await searchPacks(
      searchQuery.value,
      {
        pageSize: pageSize.value,
        pageNumber: pageNumber.value,
        restrictSearchableAttributes: searchAttributes.value,
        filters: activeFilters.value,
        sortField: sortField.value,
        sortDirection
      }
    )

    if (options.append && searchResults.value?.length) {
      searchResults.value = searchResults.value.concat(nodePacks)
    } else {
      searchResults.value = nodePacks
    }
    suggestions.value = querySuggestions
    isLoading.value = false
  }

  const onQueryChange = () => updateSearchResults({ append: false })
  const onPageChange = () => updateSearchResults({ append: true })

  watch([sortField, searchMode], onQueryChange)
  watch(activeFilters, onQueryChange, { deep: true })
  watch(pageNumber, onPageChange)
  watchDebounced(searchQuery, onQueryChange, {
    debounce: SEARCH_DEBOUNCE_TIME,
    immediate: true
  })

  const sortOptions = computed(() => {
    return getSortableFields()
  })

  const filterOptions = computed(() => {
    return getFilterableFields()
  })

  return {
    isLoading,
    pageNumber,
    pageSize,
    sortField,
    searchMode,
    searchQuery,
    suggestions,
    searchResults,
    sortOptions,
    activeFilters,
    filterOptions,
    clearCache: clearSearchCache
  }
}
