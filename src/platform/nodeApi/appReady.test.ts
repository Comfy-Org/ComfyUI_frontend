import { beforeEach, describe, expect, it, vi } from 'vitest'

// The catch that keeps one pack's failure off the others also reports it, and
// an unmocked reporter would reach the real telemetry sinks from a unit test.
const reportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({ reportError }))

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

  it('mints an id when the host cannot name a session', () => {
    // Raw workflow data with no file behind it is a new document, and the
    // host has no session to point at.
    notifyWorkflowLoaded()
    const first = currentDocumentId()
    expect(first).toBeDefined()

    notifyWorkflowLoaded()

    expect(currentDocumentId()).toBeDefined()
    expect(currentDocumentId()).not.toBe(first)
  })

  it('reports the session the host names, not one of its own', () => {
    // Two opens of the same file are two sessions, and the host is what knows
    // that — `graph.id` round-trips through the workflow JSON and is the same
    // for both.
    notifyWorkflowLoaded('session-a')
    expect(currentDocumentId()).toBe('session-a')

    notifyWorkflowLoaded('session-b')
    expect(currentDocumentId()).toBe('session-b')
  })

  it('holds the id still when the same session is configured again', () => {
    // The load-bearing case: undo and redo reach `loadGraphData` too, through
    // ChangeTracker.updateState. Minting there announced a new document on
    // every undo step, which invalidates every cached projection in the app.
    notifyWorkflowLoaded('session-a')
    const opened = currentDocumentId()

    notifyWorkflowLoaded('session-a')
    notifyWorkflowLoaded('session-a')

    expect(currentDocumentId()).toBe(opened)
  })

  it('still announces the reconfigure, so graph-derived state rebuilds', () => {
    // The event is afterConfigureGraph and must keep firing for undo; only the
    // identity holds still. A pack tells them apart by the id, not by silence.
    const listener = vi.fn()
    notifyWorkflowLoaded('session-a')
    onWorkflowLoaded(listener)

    notifyWorkflowLoaded('session-a')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(currentDocumentId()).toBe('session-a')
  })

  it('returns to the id a tab already had', () => {
    // Switching away and back is the same editing session, so a pack's stored
    // state for that tab is still valid.
    notifyWorkflowLoaded('session-a')
    notifyWorkflowLoaded('session-b')
    notifyWorkflowLoaded('session-a')

    expect(currentDocumentId()).toBe('session-a')
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
