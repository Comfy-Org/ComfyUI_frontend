import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DocumentSource } from './documentHandle'
import {
  notifyDocumentPhase,
  onDocumentPhase,
  resetDocumentLifecycleForTest
} from './documentLifecycle'

const portrait: DocumentSource = {
  sessionId: 'session-a',
  filename: 'portrait',
  path: 'workflows/portrait.json',
  isActive: true
}

describe('document lifecycle', () => {
  beforeEach(resetDocumentLifecycleForTest)

  it('hands the listener the document that triggered the phase', () => {
    const opened = vi.fn()
    onDocumentPhase('opened', opened)

    notifyDocumentPhase('opened', 'session-a', () => [portrait])

    expect(opened).toHaveBeenCalledTimes(1)
    const [document] = opened.mock.calls[0]
    expect(document.id).toBe('session-a')
    expect(document.name).toBe('portrait')
    expect(document.isDeleted).toBe(false)
  })

  it('delivers only the phase subscribed to', () => {
    const closed = vi.fn()
    onDocumentPhase('closed', closed)

    notifyDocumentPhase('opened', 'session-a', () => [portrait])

    expect(closed).not.toHaveBeenCalled()
  })

  it('reports a closed document as already gone', () => {
    // The listener must not be able to act on it as though it were still open
    // merely because it was told promptly — by the time a close is announced
    // the document is a fact of the past.
    const closed = vi.fn()
    onDocumentPhase('closed', closed)

    notifyDocumentPhase('closed', 'session-a', () => [])

    const [document] = closed.mock.calls[0]
    expect(document.isDeleted).toBe(true)
    // Still identifies what to release.
    expect(document.id).toBe('session-a')
  })

  it('stops after unsubscribing', () => {
    const opened = vi.fn()
    onDocumentPhase('opened', opened)()

    notifyDocumentPhase('opened', 'session-a', () => [portrait])

    expect(opened).not.toHaveBeenCalled()
  })

  it('runs later listeners after an earlier one throws', () => {
    // A pack mishandling a transition must not strand the packs behind it
    // holding state for a document that is already gone.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const after = vi.fn()
    onDocumentPhase('closed', () => {
      throw new Error('pack is broken')
    })
    onDocumentPhase('closed', after)

    expect(() =>
      notifyDocumentPhase('closed', 'session-a', () => [])
    ).not.toThrow()
    expect(after).toHaveBeenCalledTimes(1)
  })
})
