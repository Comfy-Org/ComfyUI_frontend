import { debounce } from 'es-toolkit'
import { onScopeDispose, watch } from 'vue'
import type { Ref } from 'vue'

import {
  captureHubFilterChange,
  hubFilterValue,
  hubSearchQuery
} from '@/scripts/hub-analytics'
import { captureWorkshopEvent } from '@/scripts/posthog'
import type { HubFilter, HubSurface } from '@/scripts/workshop-analytics'

export const SEARCH_SETTLE_MS = 800

interface HubCatalogueTracking {
  query: Ref<string>
  resultsCount: () => number
  filters: ReadonlyArray<readonly [HubFilter, () => string | readonly string[]]>
}

/**
 * Reports a search once it settles and each filter the visitor changes.
 * Changes made inside `quietly` (reading the address, restoring a page) are
 * the page's own, not the visitor's, so they are not reported.
 */
export function useHubCatalogueTracking(
  surface: HubSurface,
  { query, resultsCount, filters }: HubCatalogueTracking
) {
  let quiet = false
  let lastQuery = ''

  function sendSearch() {
    const search = hubSearchQuery(query.value)
    if (!search.query || search.query === lastQuery) return
    lastQuery = search.query
    captureWorkshopEvent({
      name: 'hub_search_performed',
      properties: { surface, ...search, results_count: resultsCount() }
    })
  }

  const settle = debounce(sendSearch, SEARCH_SETTLE_MS)
  onScopeDispose(() => settle.cancel())

  watch(
    query,
    (value) => {
      if (quiet || !value.trim()) {
        settle.cancel()
        lastQuery = hubSearchQuery(value).query
        return
      }
      settle()
    },
    { flush: 'sync' }
  )

  for (const [filter, read] of filters)
    watch(
      () => hubFilterValue(read()),
      (value, previous) => {
        if (!quiet) captureHubFilterChange(surface, filter, value, previous)
      },
      { flush: 'sync' }
    )

  function submitSearch() {
    settle.cancel()
    sendSearch()
  }

  function quietly(change: () => void) {
    quiet = true
    try {
      change()
    } finally {
      quiet = false
    }
  }

  return { submitSearch, quietly }
}
