import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

/**
 * Prefixes for the browser tab title.
 * A source clears its prefix by setting an empty value (`''`, `null` or `undefined`).
 * Prefixes show in the order each source set one; a source that clears
 * and sets again moves to the end.
 */
export const useBrowserTabTitleStore = defineStore('browserTabTitle', () => {
  const prefixes = shallowRef<ReadonlyMap<string, string>>(new Map())

  const prefix = computed(() =>
    [...prefixes.value.values()].map((text) => `[${text}] `).join('')
  )

  function setPrefix(source: string, text: string | null | undefined): void {
    const current = prefixes.value.get(source)
    if (!text ? current === undefined : current === text) return
    const next = new Map(prefixes.value)
    if (!text) next.delete(source)
    else next.set(source, text)
    prefixes.value = next
  }

  return { prefix, setPrefix }
})
