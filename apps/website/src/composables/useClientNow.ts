import type { Ref } from 'vue'
import { onMounted, ref } from 'vue'

/**
 * A reactive clock for client-side time classification. Initialises to the
 * build-time default so the server render and initial hydration agree, then
 * reconciles to the browser's current time on mount — so a time-sensitive
 * split re-evaluates without waiting for a rebuild.
 *
 * Distinct from VueUse's `useNow`, which ticks continuously and reads the real
 * clock immediately (which would break hydration): this reconciles once.
 */
export function useClientNow(defaultIso: string): Ref<Date> {
  const now = ref(new Date(defaultIso))

  onMounted(() => {
    now.value = new Date()
  })

  return now
}
