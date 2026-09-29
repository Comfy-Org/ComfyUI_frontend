import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearAllWorkflowStorage,
  clearWorkflowRestoreState
} from '@/platform/workflow/persistence/base/storageIO'
import { MAX_AGENT_STORAGE_CLOCK_SKEW_MS } from '@/workbench/extensions/agent/persistenceTime'

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
    fromPartial<PerformanceNavigationTiming>({ type: 'reload' })
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

    it('drops a record whose expiry is not finite, even on a reload', () => {
      // Written as raw JSON on purpose: `JSON.stringify(Infinity)` emits
      // `null`, so the only way to reproduce what a hostile or corrupted
      // record actually looks like on the wire is the out-of-range literal
      // that `JSON.parse` turns back into `Infinity`.
      sessionStorage.setItem(
        DOC_ID_SESSION_KEY,
        '{"docId":"wf-1","nonce":"a-different-page-load","expiresAt":1e400}'
      )
      // Reload is the permissive path: it is the one navigation type allowed
      // to adopt a foreign nonce, so it is where a never-expiring record would
      // be handed back instead of rejected.
      asReloadNavigation()

      expect(reconcilePersistedDocId()).toBeNull()
      expect(rawRecord()).toBeNull()
    })

    it('drops a record whose expiry exceeds the five-minute bound', () => {
      writeForeignRecord(
        'wf-1',
        Date.now() + DOC_ID_TTL_MS + MAX_AGENT_STORAGE_CLOCK_SKEW_MS + 1_000
      )
      asReloadNavigation()

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

    it('drops a record whose doc id is empty', () => {
      sessionStorage.setItem(
        DOC_ID_SESSION_KEY,
        JSON.stringify({
          docId: '',
          nonce: 'a-different-page-load',
          expiresAt: Date.now() + 60_000
        })
      )

      expect(reconcilePersistedDocId()).toBeNull()
      expect(rawRecord()).toBeNull()
    })
  })

  describe('reload adoption', () => {
    it('keeps a fresh record after a small backward clock adjustment', () => {
      vi.useFakeTimers()
      persistDocId('wf-1')
      vi.setSystemTime(Date.now() - 60_000)

      expect(reconcilePersistedDocId()).toBe('wf-1')
    })

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
    it('workspace switching clears it', () => {
      persistDocId('wf-1')

      clearWorkflowRestoreState()

      expect(rawRecord()).toBeNull()
    })

    it('signing out clears it', () => {
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
