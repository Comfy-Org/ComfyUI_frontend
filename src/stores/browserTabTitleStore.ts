import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

/**
 * Prefixes for the browser tab title.
 * Cleared by setting to `null`;
 * Prefixes show in the original order in which they were set.
 */
export const useBrowserTabTitleStore = defineStore('browserTabTitle', () => {
  const prefixes = shallowRef<ReadonlyMap<string, string>>(new Map())

  const prefix = computed(() =>
    [...prefixes.value.values()].map((text) => `[${text}] `).join('')
  )

  function setPrefix(source: string, text: string | null): void {
    const current = prefixes.value.get(source)
    if (text === null ? current === undefined : current === text) return
    const next = new Map(prefixes.value)
    if (text === null) next.delete(source)
    else next.set(source, text)
    prefixes.value = next
  }

  return { prefix, setPrefix }
})
