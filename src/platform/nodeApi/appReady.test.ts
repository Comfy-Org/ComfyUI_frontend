import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  markAppReady,
  notifyWorkflowLoaded,
  onAppReady,
  onWorkflowLoaded,
  resetAppReadyForTest
} from './appReady'

describe('onWorkflowLoaded', () => {
  beforeEach(resetAppReadyForTest)

  it('fires for every workflow opened, not just the first', () => {
    // This is the difference from onReady, which fires once and misses every
    // later open — a pack re-attaching itself to the document needs each one.
    const listener = vi.fn()
    onWorkflowLoaded(listener)

    notifyWorkflowLoaded()
    notifyWorkflowLoaded()

    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('stops after unsubscribing', () => {
    const listener = vi.fn()
    onWorkflowLoaded(listener)()

    notifyWorkflowLoaded()

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('onReady', () => {
  beforeEach(resetAppReadyForTest)

  it('defers a listener registered before the app starts', () => {
    const listener = vi.fn()
    onAppReady(listener)

    expect(listener).not.toHaveBeenCalled()
    markAppReady()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('still runs a listener registered after the app started', async () => {
    markAppReady()
    const listener = vi.fn()
    onAppReady(listener)

    // A lazily-loaded pack registers late. Dropping it would make the hook
    // work only for packs that happen to load early enough.
    expect(listener).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('runs each listener once, however many times readiness is signalled', () => {
    const listener = vi.fn()
    onAppReady(listener)
    markAppReady()
    markAppReady()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not run a listener unsubscribed before the app started', () => {
    const listener = vi.fn()
    onAppReady(listener)()
    markAppReady()

    expect(listener).not.toHaveBeenCalled()
  })

  it('runs later listeners after an earlier one throws', () => {
    // One pack's broken startup must not silently cancel every pack queued
    // behind it — they share a single listener set.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const after = vi.fn()
    onAppReady(() => {
      throw new Error('pack is broken')
    })
    onAppReady(after)

    expect(() => markAppReady()).not.toThrow()
    expect(after).toHaveBeenCalledTimes(1)
  })
})
