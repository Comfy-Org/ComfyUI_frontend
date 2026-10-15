import type { Ref } from 'vue'
import { computed } from 'vue'

import { stripRepoOwner } from '@/utils/searchQueryUtil'

const LEGACY_MANAGER_QUERIES: ReadonlySet<string> = new Set([
  'comfyui-manager',
  'comfyui manager',
  'manager comfyui'
])

function isLegacyManagerQuery(query: string): boolean {
  const packName = stripRepoOwner(query.trim()).trim().toLowerCase()
  return LEGACY_MANAGER_QUERIES.has(packName)
}

export function useLegacySearchTip(
  searchedQuery: Ref<string>,
  isNewManagerUI: Ref<boolean>,
  rawResultsEmpty: Ref<boolean>
) {
  const isUnmatchedLegacyManagerSearch = computed(
    () =>
      isNewManagerUI.value &&
      rawResultsEmpty.value &&
      isLegacyManagerQuery(searchedQuery.value)
  )

  return {
    isUnmatchedLegacyManagerSearch
  }
}
