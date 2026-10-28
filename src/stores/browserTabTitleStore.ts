import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

/**
 * Prefixes for the browser tab title, keyed by the feature that set them.
 * A feature sets its own already-localized text and clears it with `null`;
 * `useBrowserTabTitle` renders them without knowing which feature asked.
 * Prefixes show in the order their sources first set them.
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
