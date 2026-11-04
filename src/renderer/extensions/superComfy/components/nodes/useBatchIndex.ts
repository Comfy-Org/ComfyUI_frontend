import { computed, ref } from 'vue'
import type { WritableComputedRef } from 'vue'

/** A batch position that always stays inside the current batch. */
export function useBatchIndex(
  count: () => number
): WritableComputedRef<number> {
  const requested = ref(0)
  return computed({
    get: () => Math.max(0, Math.min(requested.value, count() - 1)),
    set: (next) => {
      requested.value = next
    }
  })
}
