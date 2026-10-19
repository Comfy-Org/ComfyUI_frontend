import {
  useDocumentVisibility,
  useEventListener,
  useIntersectionObserver,
  useRafFn
} from '@vueuse/core'
import { onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { prefersReducedMotion } from '@/composables/useReducedMotion'

export type ComparisonPlaybackState = 'loading' | 'ready' | 'error'

interface PlaybackOptions {
  enabled: () => boolean
  beforeSrc: () => string
  afterSrc: () => string
  container: Readonly<Ref<HTMLElement | null>>
  before: Readonly<Ref<HTMLVideoElement | null>>
  after: Readonly<Ref<HTMLVideoElement | null>>
  paused: Ref<boolean>
  time: Ref<number>
}

export function useComparisonPlayback(options: PlaybackOptions) {
  const state = ref<ComparisonPlaybackState>('loading')
  const visible = ref(false)
  const documentVisibility = useDocumentVisibility()
  let generation = 0
  const issuedPauses = new WeakSet<HTMLVideoElement>()

  function rememberTime() {
    const before = options.before.value
    if (before && state.value === 'ready')
      options.time.value = before.currentTime
  }

  function pausePair() {
    generation++
    ticker.pause()
    for (const video of [options.before.value, options.after.value]) {
      if (!video || video.paused) continue
      issuedPauses.add(video)
      video.pause()
    }
  }

  function duration() {
    const before = options.before.value?.duration ?? 0
    const after = options.after.value?.duration ?? 0
    return Number.isFinite(before) && Number.isFinite(after)
      ? Math.min(before, after)
      : 0
  }

  function seekPair(time: number) {
    const end = duration()
    if (end <= 0) return
    const target = Math.max(0, time % end)
    for (const video of [options.before.value, options.after.value]) {
      if (video && Math.abs(video.currentTime - target) > 1 / 24)
        video.currentTime = target
    }
  }

  function synchronize() {
    const before = options.before.value
    const after = options.after.value
    if (!before || !after || state.value !== 'ready') return
    const end = duration()
    if (end > 0 && before.currentTime >= end - 0.025) seekPair(0)
    else if (Math.abs(after.currentTime - before.currentTime) > 1 / 24)
      after.currentTime = before.currentTime
    options.time.value = before.currentTime
  }

  const ticker = useRafFn(synchronize, { immediate: false })

  async function playPair() {
    const before = options.before.value
    const after = options.after.value
    if (!before || !after) return
    const attempt = ++generation
    seekPair(options.time.value)
    before.muted = true
    after.muted = true
    const results = await Promise.allSettled([before.play(), after.play()])
    if (attempt !== generation) return
    if (results.some((result) => result.status === 'rejected')) {
      pausePair()
      options.paused.value = true
      return
    }
    ticker.resume()
  }

  function refreshReadiness() {
    if (!options.enabled() || state.value === 'error') return
    seekPair(options.time.value)
    const before = options.before.value
    const after = options.after.value
    if (
      before &&
      after &&
      before.readyState >= 3 &&
      after.readyState >= 3 &&
      duration() > 0
    )
      state.value = 'ready'
  }

  function waitForPair() {
    if (!options.enabled()) return
    rememberTime()
    state.value = 'loading'
    pausePair()
  }

  function failPair() {
    if (!options.enabled()) return
    rememberTime()
    state.value = 'error'
    pausePair()
    options.paused.value = true
  }

  useIntersectionObserver(
    options.container,
    ([entry]) => {
      visible.value = entry.isIntersecting && entry.intersectionRatio >= 0.25
    },
    { threshold: [0, 0.25], immediate: options.enabled() }
  )

  for (const video of [options.before, options.after]) {
    useEventListener(
      video,
      ['loadedmetadata', 'canplay', 'seeked'],
      refreshReadiness
    )
    useEventListener(video, 'waiting', waitForPair)
    useEventListener(video, 'error', failPair)
  }
  useEventListener(options.before, 'timeupdate', () => {
    if (options.enabled()) synchronize()
  })
  for (const video of [options.before, options.after]) {
    useEventListener(video, 'pause', (event) => {
      if (!options.enabled() || !(event.target instanceof HTMLVideoElement))
        return
      if (issuedPauses.delete(event.target)) return
      rememberTime()
      options.paused.value = true
      pausePair()
    })
  }
  watch(options.time, (time) => {
    if (options.enabled()) seekPair(time)
  })
  watch([options.beforeSrc, options.afterSrc], waitForPair)
  watch(
    () => prefersReducedMotion(),
    (reduce) => {
      if (options.enabled() && reduce) options.paused.value = true
    },
    { immediate: true }
  )
  watch(
    [options.enabled, options.paused, visible, documentVisibility, state],
    () => {
      if (!options.enabled()) return
      if (
        options.paused.value ||
        !visible.value ||
        documentVisibility.value !== 'visible' ||
        state.value !== 'ready'
      ) {
        rememberTime()
        pausePair()
        return
      }
      void playPair()
    }
  )
  onScopeDispose(() => {
    if (!options.enabled()) return
    rememberTime()
    pausePair()
  })
  return state
}
