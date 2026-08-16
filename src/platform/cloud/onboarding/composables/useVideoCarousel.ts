import {
  useDocumentVisibility,
  useIntersectionObserver,
  usePreferredReducedMotion,
  useTimeoutFn
} from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { ComponentPublicInstance, ShallowRef } from 'vue'

import { slideProgress } from '@/platform/cloud/onboarding/composables/useProgressBarPainter'
import { wrapIndex } from '@/utils/mathUtil'

const DEFAULT_FALLBACK_MS = 6000

interface VideoCarouselOptions {
  /** Fixed for the composable's lifetime: the slide list is a module constant. */
  count: number
  /** Readonly so it accepts `useTemplateRef` without widening the element type. */
  root: Readonly<ShallowRef<HTMLElement | null>>
  fallbackMs?: number
}

export function useVideoCarousel({
  count,
  root,
  fallbackMs = DEFAULT_FALLBACK_MS
}: VideoCarouselOptions) {
  const activeIndex = ref(0)
  const failedIndices = ref(new Set<number>())
  const isPlaying = ref(false)
  const videoEls = ref<(HTMLVideoElement | null)[]>([])

  /** Optimistic: the hero is above the fold, and waiting for the observer's
   *  first callback would cost a frame of playback. */
  const isVisible = ref(true)
  useIntersectionObserver(root, ([entry]) => {
    isVisible.value = entry?.isIntersecting ?? false
  })

  const documentVisibility = useDocumentVisibility()
  const motionPreference = usePreferredReducedMotion()

  const shouldPlay = computed(
    () =>
      motionPreference.value !== 'reduce' &&
      isVisible.value &&
      documentVisibility.value !== 'hidden' &&
      !failedIndices.value.has(activeIndex.value)
  )

  const setVideoRef = (
    index: number,
    el: Element | ComponentPublicInstance | null
  ) => {
    videoEls.value[index] = el instanceof HTMLVideoElement ? el : null
  }
  const activeVideo = computed(() => videoEls.value[activeIndex.value] ?? null)

  /** The direction the last move was asked to travel. Skipping a failed slide
   *  can land further than one slot, so the gap between indices does not
   *  reveal it. */
  const lastStep = ref<1 | -1>(1)

  /** Nearest slide in `delta`'s direction that has not failed. */
  const step = (delta: 1 | -1) => {
    if (count === 0) return
    // Usually one dropped connection rather than three dead sources, so clear
    // the marks and retry instead of freezing on a poster for the session.
    if (failedIndices.value.size >= count) failedIndices.value = new Set()

    let candidate = activeIndex.value
    for (let attempt = 0; attempt < count; attempt++) {
      candidate = wrapIndex(candidate + delta, count)
      if (!failedIndices.value.has(candidate)) break
    }
    lastStep.value = delta
    activeIndex.value = candidate
  }

  const goToNextSlide = () => step(1)
  const goToPreviousSlide = () => step(-1)

  /** Media events fire per slide; only the active one may act. */
  const forActiveSlide = (handle: () => void) => (index: number) => {
    if (index === activeIndex.value) handle()
  }

  /** Outside reactivity: read once per frame by `progress()`, never in a render. */
  let slideStartedAt = performance.now()

  watch(activeIndex, () => {
    slideStartedAt = performance.now()
    isPlaying.value = false
    const incoming = activeVideo.value
    if (incoming) incoming.currentTime = 0
  })

  const pauseInactiveVideos = () => {
    for (const [index, video] of videoEls.value.entries()) {
      if (video && index !== activeIndex.value) video.pause()
    }
  }

  watch(
    [shouldPlay, activeVideo],
    ([mayPlay, video]) => {
      pauseInactiveVideos()
      if (!video) return
      if (!mayPlay) {
        video.pause()
        return
      }
      // Refused (iOS Low Power Mode) or aborted by a rapid slide change.
      // Recovery is left to the watchdog, which disposes with the scope;
      // mutating state here could outlive the component.
      void video.play().catch(() => {})
    },
    { immediate: true }
  )

  const { start: startWatchdog, stop: stopWatchdog } = useTimeoutFn(
    goToNextSlide,
    fallbackMs,
    { immediate: false }
  )

  /** Armed during playback too: a mid-decode freeze emits no `waiting`, `pause`
   *  or `ended`, so silence from `timeupdate` is the only signal it died. */
  const armWatchdog = () => {
    stopWatchdog()
    if (count > 1 && shouldPlay.value) startWatchdog()
  }

  watch([isPlaying, activeIndex, shouldPlay], armWatchdog, { immediate: true })

  const nextIndex = computed(() =>
    count > 1 ? wrapIndex(activeIndex.value + 1, count) : -1
  )

  return {
    activeIndex,
    lastStep,
    setVideoRef,
    isCarouselActive: computed(() => shouldPlay.value || isPlaying.value),
    next: goToNextSlide,
    previous: goToPreviousSlide,
    onPlaying: forActiveSlide(() => {
      isPlaying.value = true
    }),
    onStalled: forActiveSlide(() => {
      isPlaying.value = false
    }),
    onEnded: forActiveSlide(goToNextSlide),
    /** Each report pushes the stall deadline out. */
    onProgress: forActiveSlide(armWatchdog),
    /** Marks the source dead so `step` skips it. */
    onError: (index: number) => {
      if (failedIndices.value.has(index)) return
      failedIndices.value = new Set(failedIndices.value).add(index)
      if (index === activeIndex.value) goToNextSlide()
    },
    /**
     * The next slide arms only once the current one is playing, so two clips
     * never compete for bandwidth. `none`, not `metadata`, for the rest: that
     * would still open a connection per slide.
     */
    preloadFor: (index: number): 'auto' | 'none' =>
      index === activeIndex.value ||
      (isPlaying.value && index === nextIndex.value)
        ? 'auto'
        : 'none',
    progress: () =>
      slideProgress({
        currentTime: activeVideo.value?.currentTime ?? 0,
        duration: activeVideo.value?.duration ?? Number.NaN,
        elapsedMs: performance.now() - slideStartedAt,
        fallbackMs
      })
  }
}
