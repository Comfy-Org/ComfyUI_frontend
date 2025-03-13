import { watchDebounced } from '@vueuse/core'
import { memoize } from 'lodash'
import { computed, ref, watch } from 'vue'

import {
  AlgoliaNodePack,
  useAlgoliaSearchService
} from '@/services/algoliaSearchService'
import { PackField } from '@/types/comfyManagerTypes'

const SEARCH_DEBOUNCE_TIME = 256
const DEFAULT_PAGE_SIZE = 16

/**
 * Composable for managing UI state of Comfy Node Registry search.
 */
export function useRegistrySearch() {
  const isLoading = ref(false)
  const sortField = ref<PackField>('downloads')
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const pageNumber = ref(0)
  const searchQuery = ref('')
  const results = ref<AlgoliaNodePack[]>([])

  const resultsAsRegistryPacks = computed(() =>
    results.value.map(algoliaToRegistry)
  )
  const resultsAsNodes = computed(() =>
    results.value.reduce(
      (acc, hit) => acc.concat(hit.comfy_nodes),
      [] as string[]
    )
  )

  const { searchPacks, toRegistryPack } = useAlgoliaSearchService()

  const algoliaToRegistry = memoize(
    toRegistryPack,
    (algoliaNode: AlgoliaNodePack) => algoliaNode.id
  )

  const onQueryChange = async () => {
    isLoading.value = true
    results.value = await searchPacks(searchQuery.value, {
      pageSize: pageSize.value,
      pageNumber: pageNumber.value
    })
    isLoading.value = false
  }

  watch([pageNumber.value, sortField.value], onQueryChange, { immediate: true })
  watchDebounced(searchQuery, onQueryChange, {
    debounce: SEARCH_DEBOUNCE_TIME
  })

  return {
    pageNumber,
    pageSize,
    sortField,
    searchQuery,
    isLoading,
    searchResults: resultsAsRegistryPacks,
    nodeSearchResults: resultsAsNodes
  }
}
