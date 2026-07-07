import { computed, toValue, watch } from 'vue'

import type { MaybeRefOrGetter } from 'vue'

export interface ActiveTab {
  name: string
  id?: string | null
}

export interface UseCanvasContextOptions {
  // The host's active workflow tab (reactive getter/ref).
  activeTab: MaybeRefOrGetter<ActiveTab | null>
  // Push a tab_switch to the server so the agent's answers track the active workflow.
  onTabChange: (tab: ActiveTab) => void
}

/**
 * useCanvasContext — mirror the host's active workflow tab to the server. The monolith
 * polled every 700ms; here a watch pushes tab_switch exactly on change (a dropped push
 * silently degrades the agent's answers, so it must fire on every real change).
 */
export function useCanvasContext(options: UseCanvasContextOptions) {
  const activeTab = computed(() => toValue(options.activeTab))

  watch(
    () => activeTab.value?.id ?? activeTab.value?.name ?? null,
    () => {
      const tab = activeTab.value
      if (tab) options.onTabChange(tab)
    },
    // Push the current tab on mount too — the server tracks no workflow until the first
    // change otherwise (the monolith's poll always reported the active tab).
    { immediate: true }
  )

  return { activeTab }
}
