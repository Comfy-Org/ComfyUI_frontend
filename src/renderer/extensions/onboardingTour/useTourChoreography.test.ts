import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type * as adapterModule from './canvasSpotlightAdapter'
import { TOUR_FOCUS_DURATION_MS } from './canvasSpotlightAdapter'

type AdapterModule = typeof adapterModule

const mocks = vi.hoisted(() => ({
  transformKey: 'a' as string | null
}))

vi.mock('./canvasSpotlightAdapter', async (importOriginal) => ({
  ...(await importOriginal<AdapterModule>()),
  canvasTransformKey: () => mocks.transformKey
}))

import { MARK_GLIDE_MS, useTourChoreography } from './useTourChoreography'

const INTRO_PREVIEW_MS = 500
const SETTLE_WATCHDOG_MS = TOUR_FOCUS_DURATION_MS + 200

function setup(options: { reduceMotion?: boolean; isStatic?: boolean } = {}) {
  const frameTarget = vi.fn()
  const choreography = useTourChoreography({
    reduceMotion: ref(options.reduceMotion ?? false),
    isStatic: ref(options.isStatic ?? false),
    frameTarget
  })
  return { ...choreography, frameTarget }
}

/** Drive the rAF sampler until the real trackSettle sees a still transform. */
function sampleUntilSettled(sampleFrame: () => void) {
  for (let i = 0; i < 4; i++) sampleFrame()
}

describe('useTourChoreography', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.transformKey = 'a'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('holds the framing until the mark has glided', () => {
    const { beginStep, frameTarget } = setup()

    beginStep()

    expect(frameTarget).not.toHaveBeenCalled()
    vi.advanceTimersByTime(MARK_GLIDE_MS)
    expect(frameTarget).toHaveBeenCalledOnce()
  })

  it('reveals the copy once the canvas transform holds still', () => {
    const { beginStep, sampleFrame, copyVisible, cameraSettled } = setup()

    beginStep()
    vi.advanceTimersByTime(MARK_GLIDE_MS)
    expect(copyVisible.value).toBe(false)

    sampleUntilSettled(sampleFrame)

    expect(copyVisible.value).toBe(true)
    expect(cameraSettled.value).toBe(true)
  })

  it('keeps the copy hidden while the camera is still moving', () => {
    const { beginStep, sampleFrame, copyVisible } = setup()

    beginStep()
    vi.advanceTimersByTime(MARK_GLIDE_MS)
    for (const key of ['b', 'c', 'd', 'e']) {
      mocks.transformKey = key
      sampleFrame()
    }

    expect(copyVisible.value).toBe(false)
  })

  it('releases the copy on the watchdog when the camera never settles', () => {
    const { beginStep, sampleFrame, copyVisible } = setup()

    beginStep()
    vi.advanceTimersByTime(MARK_GLIDE_MS)
    mocks.transformKey = 'moving'
    sampleFrame()
    expect(copyVisible.value).toBe(false)

    vi.advanceTimersByTime(SETTLE_WATCHDOG_MS)

    expect(copyVisible.value).toBe(true)
  })

  it('unpins the mark whenever the canvas moves under it', () => {
    const { beginStep, sampleFrame, markGlides } = setup()

    beginStep()
    expect(markGlides.value).toBe(true)

    mocks.transformKey = 'moved'
    sampleFrame()

    expect(markGlides.value).toBe(false)
  })

  it('frames a static step immediately and shows its copy without waiting', () => {
    const { beginStep, frameTarget, copyVisible } = setup({ isStatic: true })

    beginStep()

    expect(copyVisible.value).toBe(true)
    expect(frameTarget).not.toHaveBeenCalled()
  })

  it('previews the workflow undimmed before dimming to the first step', () => {
    const { openTour, revealed, frameTarget } = setup()

    openTour()
    expect(revealed.value).toBe(false)

    vi.advanceTimersByTime(INTRO_PREVIEW_MS)

    expect(revealed.value).toBe(true)
    // The first step frames without a glide delay: there is no prior mark to move.
    expect(frameTarget).toHaveBeenCalledOnce()
  })

  it('skips the preview and the glide when motion is reduced', () => {
    const { openTour, revealed, copyVisible, frameTarget } = setup({
      reduceMotion: true
    })

    openTour()

    expect(revealed.value).toBe(true)
    expect(copyVisible.value).toBe(true)
    expect(frameTarget).not.toHaveBeenCalled()
  })

  it('hides the copy again on a step change', () => {
    const { beginStep, sampleFrame, resetStep, copyVisible, cameraSettled } =
      setup()

    beginStep()
    vi.advanceTimersByTime(MARK_GLIDE_MS)
    sampleUntilSettled(sampleFrame)
    expect(copyVisible.value).toBe(true)

    resetStep()

    expect(copyVisible.value).toBe(false)
    expect(cameraSettled.value).toBe(false)
  })

  it('drops a pending framing when the step is reset before it runs', () => {
    const { beginStep, resetStep, frameTarget } = setup()

    beginStep()
    resetStep()
    vi.advanceTimersByTime(MARK_GLIDE_MS + SETTLE_WATCHDOG_MS)

    expect(frameTarget).not.toHaveBeenCalled()
  })

  it('stops sampling for a settle once the step is reset', () => {
    const { beginStep, resetStep, isAwaitingSettle } = setup()

    beginStep()
    expect(isAwaitingSettle()).toBe(true)

    resetStep()

    expect(isAwaitingSettle()).toBe(false)
  })

  it('leaves no timer able to reveal a scrim after the tour ends', () => {
    const { openTour, endTour, revealed } = setup()

    openTour()
    endTour()
    vi.advanceTimersByTime(INTRO_PREVIEW_MS + SETTLE_WATCHDOG_MS)

    expect(revealed.value).toBe(false)
  })

  it('leaves no watchdog able to fire after the tour ends', () => {
    const { beginStep, endTour, copyVisible } = setup()

    beginStep()
    vi.advanceTimersByTime(MARK_GLIDE_MS)
    endTour()
    vi.advanceTimersByTime(SETTLE_WATCHDOG_MS)

    expect(copyVisible.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
