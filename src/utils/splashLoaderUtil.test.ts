import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MIN_SPLASH_VISIBLE_MS,
  dismissSplashLoader,
  remainingSplashVisibleMs
} from './splashLoaderUtil'

describe('remainingSplashVisibleMs', () => {
  it('returns the full window when no time has elapsed', () => {
    expect(remainingSplashVisibleMs(1000, 1000)).toBe(MIN_SPLASH_VISIBLE_MS)
  })

  it('subtracts elapsed time from the minimum window', () => {
    expect(remainingSplashVisibleMs(1000, 1300, 800)).toBe(500)
  })

  it('clamps to zero once the window has passed', () => {
    expect(remainingSplashVisibleMs(1000, 5000, 800)).toBe(0)
  })

  it('falls back to zero when the timestamp is missing/invalid', () => {
    expect(remainingSplashVisibleMs(Number.NaN, 1000)).toBe(0)
  })
})

describe('dismissSplashLoader', () => {
  function matchMedia(reduced: boolean) {
    return vi.fn().mockReturnValue({ matches: reduced })
  }

  function mountSplash(shownAt: number = Date.now()) {
    const el = document.createElement('div')
    el.id = 'splash-loader'
    el.dataset.shownAt = String(shownAt)
    document.body.appendChild(el)
    return el
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    window.matchMedia = matchMedia(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('keeps the splash mounted until the minimum window elapses', () => {
    const el = mountSplash(0)

    dismissSplashLoader()

    vi.advanceTimersByTime(MIN_SPLASH_VISIBLE_MS - 1)
    expect(el.isConnected).toBe(true)
  })

  it('fades out and removes after the minimum window plus fade', () => {
    const el = mountSplash(0)

    dismissSplashLoader()
    vi.advanceTimersByTime(MIN_SPLASH_VISIBLE_MS)
    expect(el.style.opacity).toBe('0')
    expect(el.isConnected).toBe(true)

    vi.advanceTimersByTime(400)
    expect(el.isConnected).toBe(false)
  })

  it('removes without a fade transition under reduced motion', () => {
    window.matchMedia = matchMedia(true)
    const el = mountSplash(0)

    dismissSplashLoader()
    vi.advanceTimersByTime(MIN_SPLASH_VISIBLE_MS)

    expect(el.style.transition).toBe('')
    expect(el.isConnected).toBe(false)
  })

  it('ignores repeated calls from multiple mount sites', () => {
    const el = mountSplash(0)
    const removeSpy = vi.spyOn(el, 'remove')

    dismissSplashLoader()
    dismissSplashLoader()
    dismissSplashLoader()
    vi.advanceTimersByTime(MIN_SPLASH_VISIBLE_MS + 400)

    expect(removeSpy).toHaveBeenCalledTimes(1)
  })
})
