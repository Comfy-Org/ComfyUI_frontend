import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  clearCoachmarks,
  coachmarkElements,
  elementsFor,
  registerCoachmark,
  targetMounted,
  unregisterCoachmark,
  waitForTarget
} from './coachmarkRegistry'

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

  it('gathers the elements registered for any of several ids', () => {
    registerCoachmark('app-run-button', a)
    registerCoachmark('outputs', b)
    expect(elementsFor(['app-run-button', 'outputs'])).toEqual([a, b])
    expect(targetMounted(['app-run-button', 'outputs'])).toBe(true)
    expect(targetMounted('inputs-list')).toBe(false)
  })
})

describe('waitForTarget', () => {
  afterEach(() => {
    clearCoachmarks()
    vi.useRealTimers()
  })

  it('resolves true immediately when the target is already mounted', async () => {
    registerCoachmark('app-run-button', document.createElement('div'))
    const signal = new AbortController().signal
    await expect(waitForTarget('app-run-button', signal, 1000)).resolves.toBe(
      true
    )
  })

  it('resolves true once the target mounts before the timeout', async () => {
    const signal = new AbortController().signal
    const found = waitForTarget('app-run-button', signal, 1000)
    registerCoachmark('app-run-button', document.createElement('div'))
    await nextTick()
    await expect(found).resolves.toBe(true)
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
