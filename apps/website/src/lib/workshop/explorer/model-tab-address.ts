import { ref, watch } from 'vue'

import type { ModelTab } from './model-tabs'
import { MODEL_TAB_PARAM, parseModelTab } from './model-tabs'

function writeAddress(value: ModelTab) {
  const url = new URL(location.href)
  if (value === 'all') url.searchParams.delete(MODEL_TAB_PARAM)
  else url.searchParams.set(MODEL_TAB_PARAM, value)
  if (url.href !== location.href) history.replaceState(history.state, '', url)
}

/**
 * The Models page's category tab, kept in the address as `?tab=`. A tab the
 * page does not show opens as All and leaves the address.
 */
export function useModelTab(shown: (tab: ModelTab) => boolean = () => true) {
  const tab = ref<ModelTab>('all')

  function readAddress(search: string) {
    const named = parseModelTab(search)
    if (shown(named)) {
      tab.value = named
      return
    }
    tab.value = 'all'
    writeAddress('all')
  }

  watch(tab, writeAddress)

  return { tab, readAddress }
}
