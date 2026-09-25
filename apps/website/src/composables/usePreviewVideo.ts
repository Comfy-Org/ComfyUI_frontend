import { useDocumentVisibility, useElementVisibility } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

import { prefersReducedMotion } from './useReducedMotion'

// One visibilitychange listener for the page, not one per card: a grid can
// hold a few hundred previews, and each would otherwise subscribe on its own.
const documentVisibility =
  typeof document === 'undefined'
    ? ref<DocumentVisibilityState>('visible')
    : useDocumentVisibility()

interface PreviewVideoOptions {
  /**
   * When the preview counts as on screen. Defaults to the element's own
   * intersection with the viewport; a host that already observes a larger box
   * (the featured banner) passes its own gate instead of standing up a second
   * observer for the same rectangle.
   */
  visible?: MaybeRefOrGetter<boolean>
}

function onScreen(video: Readonly<Ref<HTMLVideoElement | null>>) {
  // Without IntersectionObserver there is nothing to gate on; load as before
  // rather than never.
  if (typeof window !== 'undefined' && !('IntersectionObserver' in window))
    return () => true
  // Start the request a little before the card scrolls in, so the first frame
  // is there when it does.
  const visible = useElementVisibility(video, {
    initialValue: false,
    rootMargin: '20% 0px'
  })
  return () => visible.value
}

function release(element: HTMLVideoElement) {
  element.pause()
  element.removeAttribute('src')
  // Removing the attribute alone does not drop the buffered resource;
  // load() with no source is what empties the element.
  element.load()
}

/**
 * Decorative preview playback bounded to what the visitor can see.
 *
 * Returns the `src` to bind: the URL while the preview is on screen, otherwise
 * `undefined`, so an offscreen card never requests its video and one that
 * scrolls away gives its buffer back. A hidden tab and reduced motion only
 * pause — the frame stays, and coming back resumes in place instead of
 * downloading again. Unmount, and a keyed element being swapped out, release
 * the media.
 */
export function usePreviewVideo(
  video: Readonly<Ref<HTMLVideoElement | null>>,
  url: MaybeRefOrGetter<string | undefined>,
  options: PreviewVideoOptions = {}
) {
  const visible = options.visible ?? onScreen(video)
  const src = computed(() => (toValue(visible) ? toValue(url) : undefined))
  const playing = computed(
    () =>
      src.value !== undefined &&
      documentVisibility.value === 'visible' &&
      !prefersReducedMotion()
  )

  watch(
    [video, src, playing],
    ([element, source, play], [previousElement, previousSource]) => {
      // A keyed <video> (the banner swaps one per slide) hands over a new
      // element; the old one has left the DOM still holding its media.
      if (previousElement && previousElement !== element)
        release(previousElement)
      if (!element) return
      if (play) void element.play().catch(() => {})
      else element.pause()
      // `src` is already gone from the DOM (post flush). Only an element that
      // actually had a source has anything to drop — not every card at
      // hydration.
      if (
        source === undefined &&
        previousSource !== undefined &&
        previousElement === element
      )
        element.load()
    },
    { flush: 'post' }
  )

  onBeforeUnmount(() => {
    if (video.value) release(video.value)
  })

  return src
}
