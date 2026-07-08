import { computed, toValue, watch } from 'vue'

import type { MaybeRefOrGetter } from 'vue'

export interface ActiveTab {
  name: string
  id?: string | null
}

export interface UseCanvasContextOptions {
  activeTab: MaybeRefOrGetter<ActiveTab | null>
  onTabChange: (tab: ActiveTab) => void
}

export function useCanvasContext(options: UseCanvasContextOptions) {
  const activeTab = computed(() => toValue(options.activeTab))

  watch(
    () => activeTab.value?.id ?? activeTab.value?.name ?? null,
    () => {
      const tab = activeTab.value
      if (tab) options.onTabChange(tab)
    },
    // Push on mount too — the server tracks no workflow until the first change otherwise.
    { immediate: true }
  )

  return { activeTab }
}
