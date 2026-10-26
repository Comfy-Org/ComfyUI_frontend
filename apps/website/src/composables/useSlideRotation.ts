import {
  useDocumentVisibility,
  useElementHover,
  useElementVisibility,
  useEventListener,
  useRafFn
} from '@vueuse/core'
import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

import { prefersReducedMotion } from './useReducedMotion'

interface SlideRotationOptions {
  readonly root: Readonly<ShallowRef<HTMLElement | null>>
  readonly count: MaybeRefOrGetter<number>
  readonly intervalMs: number
  readonly autoplay?: MaybeRefOrGetter<boolean>
}

/**
 * Rotates `count` slides every `intervalMs` while on screen and unattended;
 * never under reduced motion. `fill` is the current slide's progress, 0 to 1.
 */
export function useSlideRotation({
  root,
  count,
  intervalMs,
  autoplay = true
}: SlideRotationOptions) {
  const activeIndex = ref(0)
  const shownIndex = computed(() =>
    Math.max(0, Math.min(activeIndex.value, toValue(count) - 1))
  )

  function goTo(index: number) {
    const total = toValue(count)
    activeIndex.value = total ? (index + total) % total : 0
  }

  const hovered = useElementHover(root)
  const onScreen = useElementVisibility(root, { initialValue: true })
  const visibility = useDocumentVisibility()

  const readingByKeyboard = ref(false)
  useEventListener(root, 'focusin', () => {
    readingByKeyboard.value =
      root.value?.querySelector(':focus-visible') != null
  })
  useEventListener(root, 'focusout', () => (readingByKeyboard.value = false))

  const rotating = computed(
    () =>
      toValue(autoplay) &&
      toValue(count) > 1 &&
      onScreen.value &&
      visibility.value === 'visible' &&
      !hovered.value &&
      !readingByKeyboard.value &&
      !prefersReducedMotion()
  )

  const elapsed = ref(0)
  const { pause, resume } = useRafFn(
    ({ delta }) => {
      elapsed.value += delta
      if (elapsed.value >= intervalMs) goTo(activeIndex.value + 1)
    },
    { immediate: false }
  )

  watch(rotating, (on) => (on ? resume() : pause()), { immediate: true })
  watch(activeIndex, () => (elapsed.value = 0))

  const fill = computed(() =>
    !toValue(autoplay) || prefersReducedMotion()
      ? 1
      : Math.min(elapsed.value / intervalMs, 1)
  )

  return { activeIndex, shownIndex, goTo, fill, onScreen, rotating }
}
