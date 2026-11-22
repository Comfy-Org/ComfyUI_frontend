import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { reportError } from '@comfyorg/telemetry/reportError'
import { api } from '@/scripts/api'

import {
  createEmptyIndex,
  upsertEntry
} from '@/platform/workflow/persistence/base/draftCacheV2'
import { MAX_DRAFTS } from '@/platform/workflow/persistence/base/draftTypes'
import { hashPath } from '@/platform/workflow/persistence/base/hashUtil'
import {
  readIndex,
  resetStorageAvailable
} from '@/platform/workflow/persistence/base/storageIO'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { useWorkflowDraftStoreV2 } from './workflowDraftStoreV2'

vi.mock(import('@/scripts/api'))

beforeEach(() => {
  api.clientId = 'test-client'
  api.initialClientId = 'test-client'
})

vi.mock(import('@/scripts/app'))

const reportErrorMock = vi.hoisted(() => vi.fn<typeof reportError>())
vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: reportErrorMock
}))

const WORKSPACE = 'personal'
const INDEX_KEY = StorageKeys.draftIndex(WORKSPACE)
const PAYLOAD_PREFIX = `${StorageKeys.prefixes.draftPayload}${WORKSPACE}:`

function payloadKey(path: string): string {
  return `${PAYLOAD_PREFIX}${hashPath(path)}`
}

function quotaError(): DOMException {
  return new DOMException('Quota exceeded', 'QuotaExceededError')
}

let activeSpy: MockInstance | null = null

function withQuotaMock(
  predicate: (key: string, value: string) => boolean
): MockInstance {
  const realSetItem = localStorage.setItem.bind(localStorage)
  activeSpy = vi
    .spyOn(localStorage, 'setItem')
    .mockImplementation((key: string, value: string) => {
      if (predicate(key, value)) throw quotaError()
      return realSetItem(key, value)
    })
  return activeSpy
}

function failPayloadWrites(failTimes = Infinity): MockInstance {
  let failed = 0
  return withQuotaMock((key) => {
    if (key.startsWith(PAYLOAD_PREFIX) && failed < failTimes) {
      failed++
      return true
    }
    return false
  })
}

function saveNumberedDrafts(
  store: ReturnType<typeof useWorkflowDraftStoreV2>,
  count: number
): void {
  Array.from({ length: count }, (_, i) => i).forEach((i) => {
    expect(
      store.saveDraft(`workflows/draft${i}.json`, `{"id":${i}}`, {
        name: `draft${i}`,
        isTemporary: true
      })
    ).toBe(true)
  })
}

describe('workflowDraftStoreV2', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    resetStorageAvailable()
    activeSpy = null
  })

  afterEach(() => {
    activeSpy = null
    localStorage.clear()
    sessionStorage.clear()
  })

  it('does not rewrite the persisted index during a fresh read of a missing payload', () => {
    const store = useWorkflowDraftStoreV2()
    const path = 'workflows/missing.json'
    store.saveDraft(path, '{}', { name: 'missing', isTemporary: true })
    localStorage.removeItem(payloadKey(path))
    const { index } = upsertEntry(
      readIndex(WORKSPACE) ?? createEmptyIndex(),
      'workflows/another-tab.json',
      { name: 'another-tab', isTemporary: true, updatedAt: Date.now() }
    )
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
    const persistedIndex = localStorage.getItem(INDEX_KEY)

    expect(store.getDraft(path, { fresh: true })).toBeNull()
    expect(localStorage.getItem(INDEX_KEY)).toBe(persistedIndex)
  })

  describe('saveDraft', () => {
    it('saves draft to localStorage with separate payload', () => {
      const store = useWorkflowDraftStoreV2()

      const result = store.saveDraft('workflows/test.json', '{"nodes":[]}', {
        name: 'test',
        isTemporary: true
      })

      expect(result).toBe(true)

      const index = readIndex(WORKSPACE)
      expect(index?.v).toBe(2)
      expect(index?.order).toHaveLength(1)

      const payloadKeys = Object.keys(localStorage).filter((k) =>
        k.startsWith(PAYLOAD_PREFIX)
      )
      expect(payloadKeys).toHaveLength(1)
    })

    it('updates existing draft', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/test.json', '{"nodes":[]}', {
        name: 'test',
        isTemporary: true
      })

      store.saveDraft('workflows/test.json', '{"nodes":[1,2,3]}', {
        name: 'test-updated',
        isTemporary: false
      })

      const draft = store.getDraft('workflows/test.json')
      expect(draft).not.toBeNull()
      expect(draft!.data).toBe('{"nodes":[1,2,3]}')
      expect(draft!.name).toBe('test-updated')
      expect(draft!.isTemporary).toBe(false)
      expect(draft!.updatedAt).toEqual(expect.any(Number))
    })

    it('retains CRDT lineage when draft content changes', () => {
      const store = useWorkflowDraftStoreV2()
      const path = 'workflows/test.json'

      store.saveDraft(path, '{"nodes":[]}', {
        name: 'test',
        isTemporary: true
      })
      store.setLineage(path, { workflowId: 'wf-1', lineageSeq: 12 })
      store.saveDraft(path, '{"nodes":[1]}', {
        name: 'test',
        isTemporary: true
      })

      expect(store.getDraft(path)?.lineage).toEqual({
        workflowId: 'wf-1',
        lineageSeq: 12
      })
    })

    it('does not rewrite a draft when its CRDT lineage is unchanged', () => {
      const store = useWorkflowDraftStoreV2()
      const path = 'workflows/test.json'
      const lineage = { workflowId: 'wf-1', lineageSeq: 12 }
      store.saveDraft(path, '{"nodes":[]}', {
        name: 'test',
        isTemporary: true
      })
      store.setLineage(path, lineage)
      const setItemSpy = vi.spyOn(localStorage, 'setItem')

      store.setLineage(path, lineage)

      expect(setItemSpy).not.toHaveBeenCalled()
    })

    it('keeps payload updatedAt stable when only recency is refreshed', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/a.json', '{"id":"a"}', {
        name: 'a',
        isTemporary: true
      })
      const initialUpdatedAt = store.getDraft('workflows/a.json')!.updatedAt

      vi.advanceTimersByTime(60_000)
      store.saveDraft('workflows/b.json', '{"id":"b"}', {
        name: 'b',
        isTemporary: true
      })
      expect(store.getMostRecentPath()).toBe('workflows/b.json')

      vi.advanceTimersByTime(60_000)
      store.markDraftUsed('workflows/a.json')

      expect(store.getDraft('workflows/a.json')!.updatedAt).toBe(
        initialUpdatedAt
      )
      expect(store.getMostRecentPath()).toBe('workflows/a.json')
    })

    it('keeps all parked workflows when saving the 33rd draft', () => {
      const store = useWorkflowDraftStoreV2()

      saveNumberedDrafts(store, MAX_DRAFTS)

      expect(
        store.saveDraft('workflows/draft32.json', '{"id":32}', {
          name: 'draft32',
          isTemporary: true
        })
      ).toBe(true)
      expect(readIndex(WORKSPACE)?.order).toHaveLength(MAX_DRAFTS + 1)
      expect(store.getDraft('workflows/draft0.json')?.data).toBe('{"id":0}')
      expect(store.getDraft('workflows/draft32.json')?.data).toBe('{"id":32}')
    })

    it('updates a recovery draft after ordinary saves exceed the legacy limit', () => {
      const store = useWorkflowDraftStoreV2()
      saveNumberedDrafts(store, MAX_DRAFTS + 1)

      expect(
        store.saveDraft(
          'workflows/draft0.json',
          '{"id":0,"checkpoint":true}',
          { name: 'draft0', isTemporary: true },
          { evict: false }
        )
      ).toBe(true)
      expect(store.getDraft('workflows/draft0.json')?.data).toBe(
        '{"id":0,"checkpoint":true}'
      )
      expect(readIndex(WORKSPACE)?.order).toHaveLength(MAX_DRAFTS + 1)
    })

    it('adds a recovery draft after ordinary saves exceed the legacy limit', () => {
      const store = useWorkflowDraftStoreV2()
      saveNumberedDrafts(store, MAX_DRAFTS + 1)

      expect(
        store.saveDraft(
          'workflows/recovery.json',
          '{"recovered":true}',
          { name: 'recovery', isTemporary: true },
          { evict: false }
        )
      ).toBe(true)
      expect(store.getDraft('workflows/recovery.json')?.data).toBe(
        '{"recovered":true}'
      )
      expect(readIndex(WORKSPACE)?.order).toHaveLength(MAX_DRAFTS + 2)
    })

    it('keeps older drafts when an incoming payload hits quota', () => {
      const store = useWorkflowDraftStoreV2()
      store.saveDraft('workflows/first.json', '{"id":"first"}', {
        name: 'first',
        isTemporary: true
      })
      store.saveDraft('workflows/second.json', '{"id":"second"}', {
        name: 'second',
        isTemporary: true
      })
      failPayloadWrites()

      const result = store.saveDraft('workflows/new.json', '{"id":"new"}', {
        name: 'new',
        isTemporary: true
      })

      expect(result).toBe(false)
      expect(store.getDraft('workflows/first.json')?.data).toBe(
        '{"id":"first"}'
      )
      expect(store.getDraft('workflows/second.json')?.data).toBe(
        '{"id":"second"}'
      )
      expect(store.getDraft('workflows/new.json')).toBeNull()
    })

    it('persists a later workflow after one quota failure', () => {
      const store = useWorkflowDraftStoreV2()
      store.saveDraft('workflows/parked.json', '{"id":"parked"}', {
        name: 'parked',
        isTemporary: true
      })
      failPayloadWrites(1)

      expect(
        store.saveDraft('workflows/failed.json', '{"id":"failed"}', {
          name: 'failed',
          isTemporary: true
        })
      ).toBe(false)
      expect(
        store.saveDraft('workflows/recovered.json', '{"id":"recovered"}', {
          name: 'recovered',
          isTemporary: true
        })
      ).toBe(true)

      expect(store.getDraft('workflows/parked.json')).not.toBeNull()
      expect(store.getDraft('workflows/failed.json')).toBeNull()
      expect(store.getDraft('workflows/recovered.json')?.data).toBe(
        '{"id":"recovered"}'
      )
    })

    it('keeps every existing draft when a new index entry cannot be written', () => {
      const store = useWorkflowDraftStoreV2()
      saveNumberedDrafts(store, MAX_DRAFTS + 1)
      let indexFailureInjected = false
      withQuotaMock((key) => {
        if (key !== INDEX_KEY || indexFailureInjected) return false
        indexFailureInjected = true
        return true
      })

      const ok = store.saveDraft('workflows/incoming.json', '{"id":"new"}', {
        name: 'incoming',
        isTemporary: true
      })
      expect(ok).toBe(false)
      expect(indexFailureInjected).toBe(true)

      expect(store.getDraft('workflows/draft0.json')).not.toBeNull()
      expect(store.getDraft('workflows/draft32.json')).not.toBeNull()
      expect(store.getDraft('workflows/incoming.json')).toBeNull()
    })

    it('restores an existing payload when its index refresh hits quota', () => {
      const store = useWorkflowDraftStoreV2()
      store.saveDraft('workflows/existing.json', '{"version":1}', {
        name: 'existing',
        isTemporary: true
      })
      let indexFailureInjected = false
      withQuotaMock((key) => {
        if (key !== INDEX_KEY || indexFailureInjected) return false
        indexFailureInjected = true
        return true
      })

      const ok = store.saveDraft('workflows/existing.json', '{"version":2}', {
        name: 'existing',
        isTemporary: true
      })
      expect(ok).toBe(false)
      expect(store.getDraft('workflows/existing.json')?.data).toBe(
        '{"version":1}'
      )
    })
  })

  describe('quota reporting', () => {
    it('reports once per draft while failed saves keep retrying', () => {
      const store = useWorkflowDraftStoreV2()
      failPayloadWrites()

      expect(
        store.saveDraft('workflows/retrying.json', '{"version":1}', {
          name: 'retrying',
          isTemporary: true
        })
      ).toBe(false)
      expect(
        store.saveDraft('workflows/retrying.json', '{"version":2}', {
          name: 'retrying',
          isTemporary: true
        })
      ).toBe(false)
      expect(
        store.saveDraft('workflows/other.json', '{"version":1}', {
          name: 'other',
          isTemporary: true
        })
      ).toBe(false)

      expect(reportErrorMock).toHaveBeenCalledTimes(2)
    })

    it('reports a new failure episode after a draft recovers', () => {
      const store = useWorkflowDraftStoreV2()
      const path = 'workflows/retrying.json'
      failPayloadWrites(1)

      expect(
        store.saveDraft(path, '{"version":1}', {
          name: 'retrying',
          isTemporary: true
        })
      ).toBe(false)
      expect(
        store.saveDraft(path, '{"version":2}', {
          name: 'retrying',
          isTemporary: true
        })
      ).toBe(true)

      activeSpy?.mockRestore()
      activeSpy = null
      failPayloadWrites()
      expect(
        store.saveDraft(path, '{"version":3}', {
          name: 'retrying',
          isTemporary: true
        })
      ).toBe(false)

      expect(reportErrorMock).toHaveBeenCalledTimes(2)
    })

    it('reports an index quota failure with its write target', () => {
      const store = useWorkflowDraftStoreV2()
      withQuotaMock((key) => key === INDEX_KEY)

      expect(
        store.saveDraft('workflows/index-failure.json', '{}', {
          name: 'index-failure',
          isTemporary: true
        })
      ).toBe(false)

      expect(reportErrorMock).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          context: expect.objectContaining({ writeTarget: 'index' })
        })
      )
    })

    it('reports exhaustion without evicting existing drafts', () => {
      const store = useWorkflowDraftStoreV2()
      store.saveDraft('workflows/a.json', '{"id":"a"}', {
        name: 'a',
        isTemporary: true
      })
      failPayloadWrites()

      expect(
        store.saveDraft('workflows/incoming.json', '{"id":"new"}', {
          name: 'incoming',
          isTemporary: true
        })
      ).toBe(false)

      expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), {
        surface: 'graph',
        errorType: 'storage_quota_exhausted',
        level: 'warning',
        tags: { store: 'workflowDraftStoreV2' },
        context: {
          remainingDrafts: 1,
          incomingPayloadBytes: expect.any(Number),
          writeTarget: 'payload',
          storageTotalBytes: expect.any(Number),
          storageDraftBytes: expect.any(Number),
          storageKeyCount: 2,
          largestOtherStorageKey: null,
          largestOtherStorageKeyBytes: 0
        }
      })
    })

    it('reports storage held by drafts and by other keys', () => {
      const store = useWorkflowDraftStoreV2()
      store.saveDraft('workflows/a.json', '{"id":"a"}', {
        name: 'a',
        isTemporary: true
      })
      localStorage.setItem('Comfy.Big:client-1', 'x'.repeat(1000))
      localStorage.setItem('small', 'y')
      failPayloadWrites()

      store.saveDraft('workflows/incoming.json', '{"id":"new"}', {
        name: 'incoming',
        isTemporary: true
      })

      const draftBytes = [INDEX_KEY, payloadKey('workflows/a.json')].reduce(
        (sum, key) =>
          sum + (key.length + localStorage.getItem(key)!.length) * 2,
        0
      )
      const bigBytes = ('Comfy.Big:client-1'.length + 1000) * 2
      const smallBytes = ('small'.length + 1) * 2
      expect(reportErrorMock).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          context: expect.objectContaining({
            storageTotalBytes: draftBytes + bigBytes + smallBytes,
            storageDraftBytes: draftBytes,
            storageKeyCount: 4,
            largestOtherStorageKey: 'Comfy.Big',
            largestOtherStorageKeyBytes: bigBytes
          })
        })
      )
    })

    it('reports payload byte size measured against the serialized envelope', () => {
      const store = useWorkflowDraftStoreV2()
      const data = '{"emoji":"🚀","note":"€"}'

      failPayloadWrites()

      store.saveDraft('workflows/multibyte.json', data, {
        name: 'mb',
        isTemporary: true
      })

      const envelope = JSON.stringify({ data, updatedAt: 0 })
      const expectedBytes = new TextEncoder().encode(envelope).length
      expect(expectedBytes).toBeGreaterThan(data.length)

      expect(reportErrorMock).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          context: expect.objectContaining({
            incomingPayloadBytes: expectedBytes
          })
        })
      )
    })
  })

  describe('removeDraft', () => {
    it('removes draft from index and payload', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/test.json', '{}', {
        name: 'test',
        isTemporary: true
      })
      expect(store.getDraft('workflows/test.json')).not.toBeNull()

      store.removeDraft('workflows/test.json')
      expect(store.getDraft('workflows/test.json')).toBeNull()

      const payloadKeys = Object.keys(localStorage).filter((k) =>
        k.startsWith(PAYLOAD_PREFIX)
      )
      expect(payloadKeys).toHaveLength(0)
    })

    it('clears the quota report budget for a removed path', () => {
      const store = useWorkflowDraftStoreV2()
      failPayloadWrites()

      store.saveDraft('workflows/test.json', '{}', {
        name: 'test',
        isTemporary: true
      })
      store.removeDraft('workflows/test.json')
      store.saveDraft('workflows/test.json', '{}', {
        name: 'test',
        isTemporary: true
      })

      expect(reportErrorMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('moveDraft', () => {
    it('moves draft to new path with new name', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/old.json', '{"data":"test"}', {
        name: 'old',
        isTemporary: true
      })

      store.moveDraft('workflows/old.json', 'workflows/new.json', 'new')

      expect(store.getDraft('workflows/old.json')).toBeNull()

      const newDraft = store.getDraft('workflows/new.json')
      expect(newDraft).not.toBeNull()
      expect(newDraft!.name).toBe('new')
      expect(newDraft!.data).toBe('{"data":"test"}')
    })

    it('keeps the draft when moved onto its own path', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/same.json', '{"data":"test"}', {
        name: 'same',
        isTemporary: true
      })

      store.moveDraft('workflows/same.json', 'workflows/same.json', 'same')

      const draft = store.getDraft('workflows/same.json')
      expect(draft).not.toBeNull()
      expect(draft!.data).toBe('{"data":"test"}')
      expect(draft!.name).toBe('same')
    })

    it('preserves payload updatedAt when moving a draft', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/old.json', '{"data":"test"}', {
        name: 'old',
        isTemporary: true
      })
      const originalUpdatedAt = store.getDraft('workflows/old.json')!.updatedAt

      vi.advanceTimersByTime(5 * 60_000)
      store.moveDraft('workflows/old.json', 'workflows/new.json', 'new')

      expect(store.getDraft('workflows/new.json')!.updatedAt).toBe(
        originalUpdatedAt
      )
    })
  })

  describe('getMostRecentPath', () => {
    it('returns most recently saved path', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/a.json', '{}', {
        name: 'a',
        isTemporary: true
      })
      store.saveDraft('workflows/b.json', '{}', {
        name: 'b',
        isTemporary: true
      })

      expect(store.getMostRecentPath()).toBe('workflows/b.json')
    })

    it('returns null when no drafts', () => {
      const store = useWorkflowDraftStoreV2()
      expect(store.getMostRecentPath()).toBeNull()
    })
  })

  describe('loadPersistedWorkflow', () => {
    it('loads from preferred path when available', async () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/test.json', '{"nodes":[]}', {
        name: 'test',
        isTemporary: true
      })

      const result = await store.loadPersistedWorkflow({
        preferredPath: 'workflows/test.json'
      })

      expect(result).toBe(true)
    })

    it('falls back to most recent when preferredPath missing', async () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/recent.json', '{"nodes":[]}', {
        name: 'recent',
        isTemporary: true
      })

      const result = await store.loadPersistedWorkflow({
        preferredPath: 'workflows/missing.json',
        fallbackToLatestDraft: true
      })

      expect(result).toBe(true)
    })

    it('returns false when no drafts available', async () => {
      const store = useWorkflowDraftStoreV2()

      const result = await store.loadPersistedWorkflow({
        fallbackToLatestDraft: true
      })

      expect(result).toBe(false)
    })

    it('does not apply a draft after its identity becomes stale', async () => {
      const store = useWorkflowDraftStoreV2()
      store.saveDraft('workflows/test.json', '{"nodes":[]}', {
        name: 'test',
        isTemporary: true
      })

      const result = await store.loadPersistedWorkflow({
        preferredPath: 'workflows/test.json',
        isCurrent: () => false
      })
      const { app } = (await vi.importMock('@/scripts/app')) as {
        app: { loadGraphData: MockInstance }
      }

      expect(result).toBe(false)
      expect(app.loadGraphData).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('clears in-memory cache', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/test.json', '{}', {
        name: 'test',
        isTemporary: true
      })

      store.reset()

      // Draft should still be loadable from localStorage
      expect(store.getDraft('workflows/test.json')).not.toBeNull()
    })

    it('clears the quota report budget for the current workspace', () => {
      const store = useWorkflowDraftStoreV2()
      failPayloadWrites()

      store.saveDraft('workflows/test.json', '{}', {
        name: 'test',
        isTemporary: true
      })
      store.reset()
      store.saveDraft('workflows/test.json', '{}', {
        name: 'test',
        isTemporary: true
      })

      expect(reportErrorMock).toHaveBeenCalledTimes(2)
    })
  })
})
