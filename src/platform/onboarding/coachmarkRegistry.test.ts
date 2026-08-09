import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  clearCoachmarks,
  coachmarkElements,
  registerCoachmark,
  targetMounted,
  PLACEMENT_POLL_MS,
  unregisterCoachmark,
  waitForTarget
} from './coachmarkRegistry'
import { laidOut, mountNode, movingTarget } from './fixtures/coachmarkTargets'

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
  afterEach(() => {
    clearCoachmarks()
    document.body.replaceChildren()
  })

  it('is true once a laid-out element is registered', () => {
    expect(targetMounted('app-run-button')).toBe(false)
    registerCoachmark('app-run-button', laidOut())
    expect(targetMounted('app-run-button')).toBe(true)
  })

  it('ignores a registered target that is not laid out (e.g. hidden)', () => {
    registerCoachmark('outputs', document.createElement('div'))
    expect(targetMounted('outputs')).toBe(false)
  })

  it('resolves a moving target through the node it names', () => {
    registerCoachmark('outputs', movingTarget())
    expect(targetMounted('outputs')).toBe(false)

    mountNode()
    expect(
      targetMounted('outputs'),
      'the node mounts after the tour registers its target'
    ).toBe(true)
  })
})

describe('waitForTarget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    clearCoachmarks()
    document.body.replaceChildren()
    vi.useRealTimers()
  })

  /** Lets the poll sample once, and the resulting promise settle. */
  async function runPoll() {
    await vi.advanceTimersByTimeAsync(PLACEMENT_POLL_MS)
  }

  /** Timers beyond the caller's own timeout, i.e. a poll still scheduled. */
  function pollScheduled() {
    return vi.getTimerCount() > 1
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
    await runPoll()
    await expect(found).resolves.toBe(true)
  })

  it('keeps waiting for a registered target until it lays out', async () => {
    const el = document.createElement('div')
    registerCoachmark('outputs', el)
    const signal = new AbortController().signal
    let resolved: boolean | undefined
    void waitForTarget('outputs', signal, 1000).then((v) => (resolved = v))

    await runPoll()
    expect(resolved).toBeUndefined()

    el.getBoundingClientRect = () => new DOMRect(0, 0, 80, 30)
    await runPoll()
    expect(resolved).toBe(true)
  })

  it('keeps polling a moving target until the node it names mounts', async () => {
    registerCoachmark('outputs', movingTarget())
    const signal = new AbortController().signal
    let resolved: boolean | undefined
    void waitForTarget('outputs', signal, 1000).then((v) => (resolved = v))

    await runPoll()
    expect(resolved).toBeUndefined()

    mountNode()
    await runPoll()
    expect(
      resolved,
      'the tour registers its canvas target before the node renders'
    ).toBe(true)
  })

  it('does not poll while no candidate is registered', () => {
    const signal = new AbortController().signal
    void waitForTarget('outputs', signal, 1000)
    expect(pollScheduled()).toBe(false)
  })

  it('parks the poll when the last candidate unregisters and resumes on re-registration', async () => {
    const el = document.createElement('div')
    const signal = new AbortController().signal
    let resolved: boolean | undefined
    void waitForTarget('outputs', signal, 1000).then((v) => (resolved = v))

    registerCoachmark('outputs', el)
    await nextTick()
    expect(pollScheduled()).toBe(true)

    unregisterCoachmark('outputs', el)
    await nextTick()
    await runPoll()
    expect(pollScheduled()).toBe(false)

    registerCoachmark('outputs', laidOut())
    await nextTick()
    await Promise.resolve()
    expect(resolved).toBe(true)
  })

  it('resolves false when the target never mounts (transient failure)', async () => {
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
