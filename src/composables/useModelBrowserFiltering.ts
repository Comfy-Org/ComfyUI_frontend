import Fuse from 'fuse.js'
import { sortBy as sortByUtil } from 'es-toolkit'
import { refDebounced } from '@vueuse/core'
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { EnrichedModel } from '@/types/modelBrowserTypes'

export interface UseModelBrowserFilteringOptions {
  /** Debounce delay for search in milliseconds */
  searchDebounce?: number
}

/**
 * Composable for filtering and searching models
 */
export function useModelBrowserFiltering(
  models: MaybeRefOrGetter<EnrichedModel[]>,
  options: UseModelBrowserFilteringOptions = {}
) {
  const { searchDebounce = 300 } = options

  // Filter state
  const searchQuery = ref('')
  const selectedModelType = ref<string | null>(null)
  const sortBy = ref<'name' | 'size' | 'modified'>('name')
  const sortDirection = ref<'asc' | 'desc'>('asc')

  // Debounced search query per spec requirement (300ms)
  const debouncedSearchQuery = refDebounced(searchQuery, searchDebounce)

  // Fuse.js configuration for fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'displayName', weight: 2 },
      { name: 'simplifiedName', weight: 1.5 },
      { name: 'fileName', weight: 1 },
      { name: 'author', weight: 0.5 },
      { name: 'tags', weight: 0.3 }
    ],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true
  }

  // Step 1: Filter by model type
  const typeFiltered = computed(() => {
    const modelList = toValue(models)
    if (!selectedModelType.value) {
      return modelList
    }
    return modelList.filter(
      (model) => model.directory === selectedModelType.value
    )
  })

  // Step 2: Filter by search query (fuzzy search)
  const searchFiltered = computed(() => {
    const query = debouncedSearchQuery.value.trim()
    if (!query) {
      return typeFiltered.value
    }

    // Create Fuse instance with type-filtered results for efficient search
    const fuse = new Fuse(typeFiltered.value, fuseOptions)
    const results = fuse.search(query)
    return results.map((result) => result.item)
  })

  // Step 3: Sort results
  const filteredModels = computed(() => {
    const modelsToSort = searchFiltered.value
    const hasSearchQuery = debouncedSearchQuery.value.trim() !== ''

    // If there's a search query, preserve Fuse.js relevance order
    if (hasSearchQuery) {
      return modelsToSort
    }

    let sorted: EnrichedModel[] = []

    switch (sortBy.value) {
      case 'name':
        sorted = sortByUtil(modelsToSort, [(m) => m.displayName.toLowerCase()])
        break
      case 'size':
        sorted = sortByUtil(modelsToSort, [
          (m) => (m.size !== undefined ? m.size : Number.MAX_SAFE_INTEGER)
        ])
        break
      case 'modified':
        sorted = sortByUtil(modelsToSort, [
          (m) =>
            m.modified !== undefined ? m.modified : Number.MAX_SAFE_INTEGER
        ])
        break
      default:
        sorted = modelsToSort
    }

    // Reverse if descending
    if (sortDirection.value === 'desc') {
      sorted.reverse()
    }

    return sorted
  })

  function clearFilters() {
    searchQuery.value = ''
    selectedModelType.value = null
    sortBy.value = 'name'
    sortDirection.value = 'asc'
  }

  function clearSearch() {
    searchQuery.value = ''
  }

  return {
    // State
    searchQuery,
    selectedModelType,
    sortBy,
    sortDirection,

    // Computed
    filteredModels,
    debouncedSearchQuery,

    // Methods
    clearFilters,
    clearSearch
  }
}
