import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DOC_ID_SESSION_KEY,
  DOC_ID_TTL_MS,
  clearPersistedDocId,
  persistDocId,
  reconcilePersistedDocId
} from './persistedDocId'

function rawRecord(): {
  docId?: unknown
  nonce?: unknown
  expiresAt?: unknown
} | null {
  const raw = sessionStorage.getItem(DOC_ID_SESSION_KEY)
  return raw === null ? null : JSON.parse(raw)
}

/** Impersonate a different page load, the way tab duplication does. */
function writeForeignRecord(docId: string, expiresAt: number): void {
  sessionStorage.setItem(
    DOC_ID_SESSION_KEY,
    JSON.stringify({ docId, nonce: 'a-different-page-load', expiresAt })
  )
}

function asReloadNavigation(): void {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
    { type: 'reload' } as PerformanceNavigationTiming
  ])
}

describe('persistedDocId', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('round-trips a doc id persisted by this page load', () => {
    persistDocId('wf-1')

    expect(reconcilePersistedDocId()).toBe('wf-1')
  })

  describe('rejection consumes the record', () => {
    it('drops an expired record instead of leaving it to be re-rejected', () => {
      writeForeignRecord('wf-1', Date.now() - 1)

      expect(reconcilePersistedDocId()).toBeNull()
      expect(rawRecord()).toBeNull()
    })

    it('drops a malformed record', () => {
      sessionStorage.setItem(DOC_ID_SESSION_KEY, JSON.stringify({ docId: 7 }))

      expect(reconcilePersistedDocId()).toBeNull()
      expect(rawRecord()).toBeNull()
    })

    it('drops a pre-FEC-5 bare doc id, which is not valid JSON', () => {
      sessionStorage.setItem(DOC_ID_SESSION_KEY, 'wf-legacy')

      expect(reconcilePersistedDocId()).toBeNull()
      expect(rawRecord()).toBeNull()
    })

    it('drops an inherited record when the load is not a reload', () => {
      writeForeignRecord('wf-1', Date.now() + DOC_ID_TTL_MS)

      expect(reconcilePersistedDocId()).toBeNull()
      expect(rawRecord()).toBeNull()
    })
  })

  describe('reload adoption', () => {
    it('adopts an inherited record and takes ownership of it', () => {
      const expiresAt = Date.now() + DOC_ID_TTL_MS
      writeForeignRecord('wf-1', expiresAt)
      asReloadNavigation()

      expect(reconcilePersistedDocId()).toBe('wf-1')
      expect(rawRecord()?.nonce).not.toBe('a-different-page-load')
    })

    it('renews the owner but never the lifetime', () => {
      // One second of life left; a full re-stamp would restore the whole TTL and
      // let a tab reloaded inside the window hold the id open indefinitely.
      const expiresAt = Date.now() + 1_000
      writeForeignRecord('wf-1', expiresAt)
      asReloadNavigation()

      expect(reconcilePersistedDocId()).toBe('wf-1')
      expect(rawRecord()?.expiresAt).toBe(expiresAt)
    })

    it('lets an adopted record still lapse on its original schedule', () => {
      vi.useFakeTimers()
      writeForeignRecord('wf-1', Date.now() + 1_000)
      asReloadNavigation()
      expect(reconcilePersistedDocId()).toBe('wf-1')

      vi.advanceTimersByTime(2_000)

      expect(reconcilePersistedDocId()).toBeNull()
      expect(rawRecord()).toBeNull()
    })

    it('refuses an expired inherited record even on a reload', () => {
      writeForeignRecord('wf-1', Date.now() - 1)
      asReloadNavigation()

      expect(reconcilePersistedDocId()).toBeNull()
      expect(rawRecord()).toBeNull()
    })
  })

  it('clearPersistedDocId removes the record', () => {
    persistDocId('wf-1')

    clearPersistedDocId()

    expect(rawRecord()).toBeNull()
    expect(reconcilePersistedDocId()).toBeNull()
  })

  describe('identity transitions drop the binding', () => {
    it('workspace switching clears it', async () => {
      const { clearWorkflowRestoreState } =
        await import('@/platform/workflow/persistence/base/storageIO')
      persistDocId('wf-1')

      clearWorkflowRestoreState()

      expect(rawRecord()).toBeNull()
    })

    it('signing out clears it', async () => {
      const { clearAllWorkflowStorage } =
        await import('@/platform/workflow/persistence/base/storageIO')
      persistDocId('wf-1')

      clearAllWorkflowStorage()

      expect(rawRecord()).toBeNull()
    })

    it('a reload after the transition has nothing to adopt', () => {
      persistDocId('wf-1')
      clearPersistedDocId()
      asReloadNavigation()

      expect(reconcilePersistedDocId()).toBeNull()
    })
  })
})
