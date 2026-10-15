import type { Ref } from 'vue'
import { computed } from 'vue'

import { stripRepoOwner } from '@/utils/searchQueryUtil'

const LEGACY_MANAGER_PACK_NAMES: ReadonlySet<string> = new Set([
  'comfyui-manager',
  'manager-comfyui'
])

const TRAILING_GIT_OR_SLASHES = /(?:\.git)?\/*$/

const WORD_SEPARATOR_RUN = /[\s_-]+/g

function isLegacyManagerQuery(query: string): boolean {
  const packName = stripRepoOwner(query.trim().toLowerCase())
    .replace(TRAILING_GIT_OR_SLASHES, '')
    .trim()
    .replace(WORD_SEPARATOR_RUN, '-')
  return LEGACY_MANAGER_PACK_NAMES.has(packName)
}

export function useLegacySearchTip(
  searchedQuery: Ref<string>,
  isNewManagerUI: Ref<boolean>,
  rawResultsEmpty: Ref<boolean>,
  showsSearchResults: Ref<boolean>
) {
  const isUnmatchedLegacyManagerSearch = computed(
    () =>
      isNewManagerUI.value &&
      showsSearchResults.value &&
      rawResultsEmpty.value &&
      isLegacyManagerQuery(searchedQuery.value)
  )

  return {
    isUnmatchedLegacyManagerSearch
  }
}
