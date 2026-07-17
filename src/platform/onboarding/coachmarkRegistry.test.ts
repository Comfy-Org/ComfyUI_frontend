import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  clearCoachmarks,
  coachmarkElements,
  registerCoachmark,
  targetMounted,
  unregisterCoachmark,
  waitForTarget
} from './coachmarkRegistry'

/** An element with a non-zero measured rect, so it counts as laid out. */
function laidOut(): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => new DOMRect(0, 0, 80, 30)
  return el
}

describe('coachmarkRegistry', () => {
  const a = document.createElement('div')
  const b = document.createElement('div')

  afterEach(clearCoachmarks)

  it('resolves every element registered for an id', () => {
    registerCoachmark('app-run-button', a)
    registerCoachmark('app-run-button', b)
    expect(coachmarkElements('app-run-button')).toEqual([a, b])
  })

  it('keeps the remaining elements when one of several unregisters', () => {
    registerCoachmark('app-run-button', a)
    registerCoachmark('app-run-button', b)
    unregisterCoachmark('app-run-button', a)
    expect(coachmarkElements('app-run-button')).toEqual([b])
  })
})

describe('targetMounted', () => {
  afterEach(clearCoachmarks)

  it('is true once a laid-out element is registered', () => {
    expect(targetMounted('app-run-button')).toBe(false)
    registerCoachmark('app-run-button', laidOut())
    expect(targetMounted('app-run-button')).toBe(true)
  })

  it('ignores a registered target that is not laid out (e.g. hidden)', () => {
    registerCoachmark('outputs', document.createElement('div'))
    expect(targetMounted('outputs')).toBe(false)
  })
})

describe('waitForTarget', () => {
  let frames: Array<() => void>

  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(() => cb(0))
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    clearCoachmarks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Drain the poll queue; an unresolved poll reschedules, so cap the drain to
  // avoid spinning when the target never lays out.
  function runFrames(max = 50) {
    let ran = 0
    while (frames.length && ran < max) {
      frames.shift()!()
      ran++
    }
  }

  it('resolves true immediately when a laid-out target is already mounted', async () => {
    registerCoachmark('app-run-button', laidOut())
    const signal = new AbortController().signal
    await expect(waitForTarget('app-run-button', signal, 1000)).resolves.toBe(
      true
    )
  })

  it('resolves true once the target lays out before the timeout', async () => {
    const signal = new AbortController().signal
    const found = waitForTarget('app-run-button', signal, 1000)
    registerCoachmark('app-run-button', laidOut())
    runFrames()
    await expect(found).resolves.toBe(true)
  })

  it('keeps waiting for a registered target until it lays out', async () => {
    const el = document.createElement('div')
    registerCoachmark('outputs', el)
    const signal = new AbortController().signal
    let resolved: boolean | undefined
    void waitForTarget('outputs', signal, 1000).then((v) => (resolved = v))

    runFrames()
    await Promise.resolve()
    expect(resolved).toBeUndefined()

    el.getBoundingClientRect = () => new DOMRect(0, 0, 80, 30)
    runFrames()
    await Promise.resolve()
    expect(resolved).toBe(true)
  })

  it('does not schedule rAF polling while no candidate is registered', () => {
    const signal = new AbortController().signal
    void waitForTarget('outputs', signal, 1000)
    expect(frames).toHaveLength(0)
  })

  it('parks the poll when the last candidate unregisters and resumes on re-registration', async () => {
    const el = document.createElement('div')
    const signal = new AbortController().signal
    let resolved: boolean | undefined
    void waitForTarget('outputs', signal, 1000).then((v) => (resolved = v))

    registerCoachmark('outputs', el)
    await nextTick()
    expect(frames.length).toBeGreaterThan(0)

    unregisterCoachmark('outputs', el)
    await nextTick()
    runFrames()
    expect(frames).toHaveLength(0)

    registerCoachmark('outputs', laidOut())
    await nextTick()
    await Promise.resolve()
    expect(resolved).toBe(true)
  })

  it('resolves false when the target never mounts (transient failure)', async () => {
    vi.useFakeTimers()
    const signal = new AbortController().signal
    const found = waitForTarget('outputs', signal, 1000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(found).resolves.toBe(false)
  })

  it('resolves false when aborted before the target mounts', async () => {
    const controller = new AbortController()
    const found = waitForTarget('outputs', controller.signal, 10000)
    controller.abort()
    await expect(found).resolves.toBe(false)
  })
})
