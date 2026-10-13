import { ref, watch } from 'vue'

import type { UseCase } from '@/config/models-catalogue'
import {
  CATEGORY_PARAM,
  USE_CASE_PARAM,
  parseUseCases
} from '@/lib/workshop/use-case-address'
import type { ModelTabCounts } from './model-tab-counts'
import type { ModelTab } from './model-tabs'
import { tabForUseCases, useCasesInTab } from './model-tabs'
import { useModelTab } from './model-tab-address'

/** Sets or drops one parameter of the page address without a history entry. */
export function writeParam(name: string, value: string) {
  const url = new URL(location.href)
  if (value) url.searchParams.set(name, value)
  else url.searchParams.delete(name)
  if (url.href !== location.href) history.replaceState(history.state, '', url)
}

/**
 * A catalogue's type sidebar and Best-for selection, kept in step with each
 * other and with the address as `?tab=` and `?useCase=`.
 */
export function useCatalogueType(counts: () => ModelTabCounts) {
  const listed = (tab: ModelTab) => (counts().get(tab) ?? 0) > 0
  const { tab, readAddress: readTab } = useModelTab(listed)
  const selectedUseCases = ref<UseCase[]>([])

  function readAddress(search: string) {
    const opened = parseUseCases(search)
    readTab(search)
    const implied = tabForUseCases(opened, tab.value)
    if (listed(implied)) tab.value = implied
    selectedUseCases.value =
      tab.value === 'all' ? opened : useCasesInTab(opened, tab.value)
    writeParam(CATEGORY_PARAM, '')
  }

  function selectTab(next: ModelTab) {
    tab.value = next
    selectedUseCases.value =
      next === 'all' ? [] : useCasesInTab(selectedUseCases.value, next)
  }

  function keepOffered(offered: readonly { readonly value: string }[]) {
    if (tab.value === 'all') return
    const kept = selectedUseCases.value.filter((useCase) =>
      offered.some((option) => option.value === useCase)
    )
    if (kept.length !== selectedUseCases.value.length)
      selectedUseCases.value = kept
  }

  watch(selectedUseCases, (value) =>
    writeParam(USE_CASE_PARAM, value.join(','))
  )
  watch(selectedUseCases, (selected) => {
    if (tab.value !== 'all') return
    const implied = tabForUseCases(selected, 'all')
    if (implied !== 'all' && listed(implied)) tab.value = implied
  })

  return { tab, selectedUseCases, readAddress, selectTab, keepOffered }
}
