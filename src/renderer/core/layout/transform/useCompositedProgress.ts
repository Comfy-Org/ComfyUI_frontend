import {
  TransitionPresets,
  tryOnScopeDispose,
  usePreferredReducedMotion,
  useTransition
} from '@vueuse/core'
import { computed, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

const SCRUB_DURATION_MS = 1000
const EASE_DURATION_MS = 300

/**
 * Drives an element between two keyframes by scrubbing a paused animation, so
 * a progress change reaches the compositor directly. A CSS transition forces a
 * full compositing update when it starts and again when it ends.
 */
export function useCompositedProgress(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  progress: MaybeRefOrGetter<number>,
  keyframes: Keyframe[]
) {
  const motionPreference = usePreferredReducedMotion()
  const eased = useTransition(
    () => Math.min(Math.max(toValue(progress), 0), 1),
    {
      duration: EASE_DURATION_MS,
      transition: TransitionPresets.easeOutCubic,
      disabled: computed(() => motionPreference.value === 'reduce')
    }
  )

  let animation: Animation | undefined
  let animatedElement: HTMLElement | undefined

  function release() {
    if (animation) animation.effect = null
    animation = undefined
    animatedElement = undefined
  }

  watch(
    [() => toValue(target), eased],
    ([element, value]) => {
      if (!element) {
        release()
        return
      }
      if (animatedElement !== element) {
        release()
        animation = element.animate(keyframes, {
          duration: SCRUB_DURATION_MS,
          fill: 'both'
        })
        animation.pause()
        animatedElement = element
      }
      if (animation) animation.currentTime = value * SCRUB_DURATION_MS
    },
    { immediate: true, flush: 'post' }
  )

  tryOnScopeDispose(release)
}
