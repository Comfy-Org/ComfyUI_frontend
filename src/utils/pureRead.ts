import { computed } from 'vue'
import type { ComputedRef } from 'vue'

/** Exposes a pure synchronous lookup as a Pinia getter, so calls skip the action wrapper. */
export function pureRead<TRead extends (...args: never[]) => unknown>(
  read: TRead
): ComputedRef<TRead> {
  return computed(() => read)
}
