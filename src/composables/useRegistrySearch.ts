import { debounce } from 'lodash'
import { onUnmounted, ref, watch } from 'vue'

import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { components } from '@/types/comfyRegistryTypes'

const SEARCH_DEBOUNCE_TIME = 256
const DEFAULT_PAGE_SIZE = 60
const DEFAULT_SORT_FIELD: keyof components['schemas']['Node'] = 'downloads'

/**
 * Composable for managing UI state of Comfy Node Registry search.
 */
export function useRegistrySearch() {
  const registryStore = useComfyRegistryStore()
  const registryService = useComfyRegistryService()

  const searchQuery = ref('')
  const pageNumber = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const sortField = ref<keyof components['schemas']['Node']>(DEFAULT_SORT_FIELD)
  const searchResults = ref<components['schemas']['Node'][]>([])

  const search = async () => {
    try {
      const isEmptySearch = searchQuery.value === ''
      const result = isEmptySearch
        ? await registryStore.listAllPacks({
            page: pageNumber.value,
            limit: pageSize.value,
            sort: [sortField.value]
          })
        : await registryService.search({
            search: searchQuery.value,
            page: pageNumber.value,
            limit: pageSize.value
          })

      if (result) {
        searchResults.value = result.nodes || []
      } else {
        searchResults.value = []
      }
    } catch (err) {
      console.error('Error loading packs:', err)
      searchResults.value = []
    }
  }

  const debouncedSearch = debounce(search, SEARCH_DEBOUNCE_TIME)

  // Debounce search when query changes
  watch(() => searchQuery.value, debouncedSearch)

  watch(() => [pageNumber.value, sortField.value], search, { immediate: true })

  onUnmounted(() => {
    debouncedSearch.cancel() // Cancel debounced searches
    registryStore.cancelRequests() // Cancel in-flight requests
    registryStore.clearCache() // Clear cached responses
  })

  return {
    pageNumber,
    pageSize,
    sortField,
    searchQuery,
    searchResults,
    isLoading: registryService.isLoading,
    error: registryService.error
  }
}
