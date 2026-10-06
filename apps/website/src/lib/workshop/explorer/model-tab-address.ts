import { ref, watch } from 'vue'

import type { ModelTab } from './model-tabs'
import { MODEL_TAB_PARAM, parseModelTab } from './model-tabs'

/** The Models page's category tab, kept in the address as `?tab=`. */
export function useModelTab() {
  const tab = ref<ModelTab>('all')

  function readAddress(search: string) {
    tab.value = parseModelTab(search)
  }

  watch(tab, (value) => {
    const url = new URL(location.href)
    if (value === 'all') url.searchParams.delete(MODEL_TAB_PARAM)
    else url.searchParams.set(MODEL_TAB_PARAM, value)
    if (url.href !== location.href) history.replaceState(history.state, '', url)
  })

  return { tab, readAddress }
}
