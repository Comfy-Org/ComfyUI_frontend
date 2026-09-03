import { beforeEach, describe, expect, it, vi } from 'vitest'

// The catch that keeps one pack's failure off the others also reports it, and
// an unmocked reporter would reach the real telemetry sinks from a unit test.
const reportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({ reportError }))

import {
  currentDocumentId,
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

describe('currentDocumentId', () => {
  beforeEach(resetAppReadyForTest)

  it('is undefined before any workflow has loaded', () => {
    // Not a sentinel a pack has to special-case forever — just the honest
    // state before the first `notifyWorkflowLoaded()`.
    expect(currentDocumentId()).toBeUndefined()
  })

  it('mints a fresh id each time a workflow finishes loading', () => {
    notifyWorkflowLoaded()
    const first = currentDocumentId()
    expect(first).toBeDefined()

    notifyWorkflowLoaded()
    const second = currentDocumentId()

    // Two loads of the SAME file must still mint two different ids — this is
    // a load-session identity, not the file's own saved `graph.id` (which
    // round-trips through the workflow JSON and is deliberately excluded from
    // deciding this).
    expect(second).toBeDefined()
    expect(second).not.toBe(first)
  })

  it('is visible to a listener registered before the load it describes', () => {
    // The id must be current by the time onWorkflowLoaded listeners run, not
    // settled a tick later — a listener reading it during its own callback is
    // the whole point of pairing the two.
    let seenDuringCallback: string | undefined
    onWorkflowLoaded(() => {
      seenDuringCallback = currentDocumentId()
    })

    notifyWorkflowLoaded()

    expect(seenDuringCallback).toBe(currentDocumentId())
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

  it('does not run a late listener unsubscribed before delivery', async () => {
    markAppReady()
    const listener = vi.fn()
    onAppReady(listener)()

    await Promise.resolve()

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
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'node_api_lifecycle_listener_failure'
      })
    )
  })
})
