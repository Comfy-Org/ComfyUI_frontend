import { useIntervalFn, usePreferredReducedMotion } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { FrameRate } from '@/lib/workshop/sprite-sheet/options'
import { nextFrameRate } from '@/lib/workshop/sprite-sheet/options'

/** Plays `count()` frames on a loop at a frame rate the visitor picks. */
export function useSpritePlayback(count: () => number) {
  const reduced = usePreferredReducedMotion()
  const playing = ref(reduced.value !== 'reduce')
  const fps = ref<FrameRate>(8)
  const onion = ref(false)
  const frame = ref(0)
  const total = computed(() => Math.max(1, count()))

  useIntervalFn(
    () => {
      if (playing.value) frame.value = (frame.value + 1) % total.value
    },
    () => 1000 / fps.value
  )

  watch(total, (next) => {
    if (frame.value >= next) frame.value = 0
  })

  /** Stops on frame `index`, to look at it. */
  function show(index: number) {
    playing.value = false
    frame.value = ((index % total.value) + total.value) % total.value
  }

  return {
    playing,
    fps,
    onion,
    frame,
    total,
    previous: computed(() => (frame.value - 1 + total.value) % total.value),
    show,
    toggle: () => (playing.value = !playing.value),
    nextRate: () => (fps.value = nextFrameRate(fps.value))
  }
}

export type SpritePlayback = ReturnType<typeof useSpritePlayback>
