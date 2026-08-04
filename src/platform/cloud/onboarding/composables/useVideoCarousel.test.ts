import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import type { EffectScope } from 'vue'

import { slideProgress } from '@/platform/cloud/onboarding/composables/useProgressBarPainter'
import { useVideoCarousel } from '@/platform/cloud/onboarding/composables/useVideoCarousel'

const FALLBACK_MS = 6000

type Carousel = ReturnType<typeof useVideoCarousel>

/**
 * happy-dom implements play/pause/currentTime but leaves `duration` a read-only
 * NaN, so only that one property is patched onto a real media element.
 */
function createVideo(duration = 10) {
  const el = document.createElement('video')
  Object.defineProperty(el, 'duration', { value: duration, configurable: true })
  vi.spyOn(el, 'play').mockResolvedValue(undefined)
  vi.spyOn(el, 'pause').mockImplementation(() => {})
  return el
}

let scope: EffectScope

async function mountCarousel(slideCount: number) {
  const rootEl = document.createElement('div')
  document.body.append(rootEl)
  const root = shallowRef<HTMLElement | null>(rootEl)
  let carousel!: Carousel
  scope = effectScope()
  scope.run(() => {
    carousel = useVideoCarousel({
      count: slideCount,
      root,
      fallbackMs: FALLBACK_MS
    })
  })
  const videos = Array.from({ length: slideCount }, () => createVideo())
  videos.forEach((el, index) => carousel.setVideoRef(index, el))
  await nextTick()
  return { carousel, videos, rootEl }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  scope?.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useVideoCarousel', () => {
  it('advances when the active video ends and wraps past the last slide', async () => {
    const { carousel } = await mountCarousel(3)

    carousel.onEnded(0)
    expect(carousel.activeIndex.value).toBe(1)

    carousel.onEnded(1)
    carousel.onEnded(2)
    expect(carousel.activeIndex.value).toBe(0)
  })

  it('ignores an ended event from a slide that is not active', async () => {
    const { carousel } = await mountCarousel(3)

    carousel.onEnded(2)

    expect(carousel.activeIndex.value).toBe(0)
  })

  it('skips over an already-failed slide rather than landing on it', async () => {
    const { carousel } = await mountCarousel(3)

    carousel.onError(1)
    expect(carousel.activeIndex.value).toBe(0)

    carousel.next()
    expect(carousel.activeIndex.value).toBe(2)
  })

  it('retries from the start once every slide has failed', async () => {
    const { carousel } = await mountCarousel(3)

    carousel.onError(0)
    carousel.onError(1)
    carousel.onError(2)
    expect(
      carousel.activeIndex.value,
      'the third failure exhausts the set, which clears it and lands back on slide 0 rather than freezing on a poster for the session'
    ).toBe(0)

    carousel.next()

    expect(
      carousel.activeIndex.value,
      'cleared marks mean the reel keeps advancing'
    ).toBe(1)
  })

  it('ignores a repeated error from a slide already marked failed', async () => {
    const { carousel } = await mountCarousel(3)

    carousel.onError(0)
    expect(carousel.activeIndex.value).toBe(1)

    carousel.onError(0)

    expect(carousel.activeIndex.value).toBe(1)
  })

  it('advances on the watchdog when playback never starts', async () => {
    const { carousel } = await mountCarousel(3)

    await vi.advanceTimersByTimeAsync(FALLBACK_MS)

    expect(carousel.activeIndex.value).toBe(1)
  })

  it('holds the slide while the active video keeps reporting progress', async () => {
    const { carousel } = await mountCarousel(3)

    carousel.onPlaying(0)
    await nextTick()

    for (let tick = 0; tick < 4; tick++) {
      await vi.advanceTimersByTimeAsync(FALLBACK_MS / 2)
      carousel.onProgress(0)
    }

    expect(
      carousel.activeIndex.value,
      'each progress report pushes the stall deadline out past the watchdog'
    ).toBe(0)
  })

  it('advances when a playing video silently stops reporting progress', async () => {
    const { carousel } = await mountCarousel(3)

    carousel.onPlaying(0)
    await nextTick()
    await vi.advanceTimersByTimeAsync(FALLBACK_MS)

    expect(
      carousel.activeIndex.value,
      'a mid-decode freeze emits no waiting/pause/ended, so silence is the only signal the reel has died'
    ).toBe(1)
  })

  it('does not run a watchdog for a single slide', async () => {
    await mountCarousel(1)

    expect(
      vi.getTimerCount(),
      'activeIndex cannot move with one slide, so a pending timer is the only observable difference'
    ).toBe(0)
  })

  it('preloads only the active slide until it is playing, then arms the next', async () => {
    const { carousel } = await mountCarousel(3)

    expect(carousel.preloadFor(0)).toBe('auto')
    expect(carousel.preloadFor(1)).toBe('none')
    expect(carousel.preloadFor(2)).toBe('none')

    carousel.onPlaying(0)
    await nextTick()

    expect(carousel.preloadFor(1)).toBe('auto')
    expect(carousel.preloadFor(2)).toBe('none')
  })

  it('rewinds the incoming slide and pauses the outgoing one', async () => {
    const { carousel, videos } = await mountCarousel(3)
    videos[0].currentTime = 4
    videos[1].currentTime = 7

    carousel.next()
    await nextTick()

    expect(videos[1].currentTime).toBe(0)
    expect(videos[0].pause).toHaveBeenCalled()
  })

  it('pauses playback while the tab is hidden', async () => {
    const { carousel, videos } = await mountCarousel(3)
    carousel.onPlaying(0)
    await nextTick()

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()

    expect(videos[0].pause).toHaveBeenCalled()
  })

  it('never plays or advances when reduced motion is preferred', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    )
    const { carousel, videos } = await mountCarousel(3)
    await vi.advanceTimersByTimeAsync(FALLBACK_MS * 2)

    expect(videos[0].play).not.toHaveBeenCalled()
    expect(vi.getTimerCount(), 'no watchdog is armed either').toBe(0)
    expect(carousel.activeIndex.value).toBe(0)
  })

  it('advances after a playing video reports it has stalled', async () => {
    const { carousel } = await mountCarousel(3)
    carousel.onPlaying(0)
    await nextTick()
    carousel.onProgress(0)

    carousel.onStalled(0)
    await nextTick()
    await vi.advanceTimersByTimeAsync(FALLBACK_MS)

    expect(carousel.activeIndex.value).toBe(1)
  })

  it('reports the carousel inactive once playback is paused and stopped', async () => {
    const { carousel } = await mountCarousel(3)
    carousel.onPlaying(0)
    await nextTick()
    expect(carousel.isCarouselActive.value).toBe(true)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    carousel.onStalled(0)
    await nextTick()

    expect(carousel.isCarouselActive.value).toBe(false)
  })
})

describe('slideProgress', () => {
  it('uses the media clock when the duration is usable', () => {
    expect(
      slideProgress({
        currentTime: 3,
        duration: 12,
        elapsedMs: 0,
        fallbackMs: FALLBACK_MS
      })
    ).toBe(0.25)
  })

  it.for([Number.NaN, Number.POSITIVE_INFINITY, 0])(
    'falls back to elapsed time when duration is %s',
    (duration) => {
      expect(
        slideProgress({
          currentTime: 3,
          duration,
          elapsedMs: 1500,
          fallbackMs: FALLBACK_MS
        })
      ).toBe(0.25)
    }
  )

  it('clamps a playhead that overruns its reported duration', () => {
    expect(
      slideProgress({
        currentTime: 30,
        duration: 12,
        elapsedMs: 0,
        fallbackMs: FALLBACK_MS
      })
    ).toBe(1)
  })
})
