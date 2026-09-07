import { useTimeoutFn } from '@vueuse/core'
import { toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

type CarouselAutoplayOptions = {
  delayMs: MaybeRefOrGetter<number>
  active: MaybeRefOrGetter<boolean>
  resetKey: MaybeRefOrGetter<unknown>
  advance: () => void
}

// Restarts a per-slide timer whenever `resetKey` (the active slide) changes, so
// manual navigation resets the current slide's timer and each slide advances
// after its own `delayMs`. `useTimeoutFn` re-reads `delayMs` on each start and
// clears itself on scope dispose.
export function useCarouselAutoplay(options: CarouselAutoplayOptions): void {
  const { delayMs, active, resetKey, advance } = options
  const { start, stop } = useTimeoutFn(advance, delayMs, { immediate: false })

  watch(
    [() => toValue(active), () => toValue(resetKey)],
    () => {
      stop()
      if (toValue(active)) start()
    },
    { immediate: true }
  )
}
