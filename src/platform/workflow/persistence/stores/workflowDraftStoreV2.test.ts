import { createTestingPinia } from '@pinia/testing'
import type { MockInstance } from 'vitest'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { reportError } from '@/platform/telemetry/reportError'

import { createEmptyIndex } from '../base/draftCacheV2'
import { MAX_DRAFTS } from '../base/draftTypes'
import { readIndex, resetStorageAvailable } from '../base/storageIO'
import { StorageKeys } from '../base/storageKeys'
import { useWorkflowDraftStoreV2 } from './workflowDraftStoreV2'

vi.mock('@/scripts/api', () => ({
  api: {
    clientId: 'test-client',
    initialClientId: 'test-client'
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    loadGraphData: vi.fn().mockResolvedValue(undefined)
  }
}))

const reportErrorMock = vi.hoisted(() => vi.fn<typeof reportError>())
vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: reportErrorMock
}))

const WORKSPACE = 'personal'
const INDEX_KEY = StorageKeys.draftIndex(WORKSPACE)
const PAYLOAD_PREFIX = `${StorageKeys.prefixes.draftPayload}${WORKSPACE}:`

function quotaError(): DOMException {
  return new DOMException('Quota exceeded', 'QuotaExceededError')
}

function payloadKey(path: string): string {
  return `${PAYLOAD_PREFIX}${path}`
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

describe('workflowDraftStoreV2', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    localStorage.clear()
    sessionStorage.clear()
    resetStorageAvailable()
    activeSpy = null
  })

  afterEach(() => {
    activeSpy?.mockRestore()
    activeSpy = null
    localStorage.clear()
    sessionStorage.clear()
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
      expect(index?.v).toBe(3)
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

    it('saves, reads, and deletes known colliding V2-hash paths independently', () => {
      const store = useWorkflowDraftStoreV2()
      const pathA = 'workflows/ewip.json'
      const pathB = 'workflows/4hbab.json'

      expect(
        store.saveDraft(pathA, '{"id":"a"}', {
          name: 'a',
          isTemporary: true
        })
      ).toBe(true)
      expect(
        store.saveDraft(pathB, '{"id":"b"}', {
          name: 'b',
          isTemporary: true
        })
      ).toBe(true)

      expect(store.getDraft(pathA)?.data).toBe('{"id":"a"}')
      expect(store.getDraft(pathB)?.data).toBe('{"id":"b"}')
      expect(readIndex(WORKSPACE)?.order).toEqual([pathA, pathB])

      store.removeDraft(pathA)
      expect(store.getDraft(pathA)).toBeNull()
      expect(store.getDraft(pathB)?.data).toBe('{"id":"b"}')
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

    it('evicts oldest when over limit', () => {
      const store = useWorkflowDraftStoreV2()

      for (let i = 0; i < MAX_DRAFTS; i++) {
        store.saveDraft(`workflows/draft${i}.json`, `{"id":${i}}`, {
          name: `draft${i}`,
          isTemporary: true
        })
      }

      // Save one more
      store.saveDraft('workflows/new.json', '{"id":"new"}', {
        name: 'new',
        isTemporary: true
      })

      // First draft should be evicted
      expect(store.getDraft('workflows/draft0.json')).toBeNull()
      expect(store.getDraft('workflows/new.json')).not.toBeNull()
    })

    it('evicts the oldest draft and retries when a payload write hits quota', () => {
      const store = useWorkflowDraftStoreV2()

      for (let i = 0; i < MAX_DRAFTS - 1; i++) {
        store.saveDraft(`workflows/draft${i}.json`, `{"id":${i}}`, {
          name: `draft${i}`,
          isTemporary: true
        })
      }

      const newDraftPayloadKey = StorageKeys.draftPayload(
        'workflows/new.json',
        'personal'
      )
      let quotaFailureInjected = false
      withQuotaMock((key) => {
        if (key !== newDraftPayloadKey || quotaFailureInjected) return false
        quotaFailureInjected = true
        return true
      })

      const result = store.saveDraft('workflows/new.json', '{"id":"new"}', {
        name: 'new',
        isTemporary: true
      })

      expect(result).toBe(true)
      expect(quotaFailureInjected).toBe(true)
      expect(store.getDraft('workflows/draft0.json')).toBeNull()
      expect(store.getDraft('workflows/new.json')?.data).toBe('{"id":"new"}')
    })

    it('keeps overflow-evicted payloads on disk when the index write fails', () => {
      const store = useWorkflowDraftStoreV2()

      for (let i = 0; i < MAX_DRAFTS; i++) {
        store.saveDraft(`workflows/draft${i}.json`, `{"id":${i}}`, {
          name: `draft${i}`,
          isTemporary: true
        })
      }
      const evictedPayloadKey = payloadKey('workflows/draft0.json')
      expect(localStorage.getItem(evictedPayloadKey)).not.toBeNull()

      let indexFailureInjected = false
      withQuotaMock((key) => {
        if (key !== INDEX_KEY || indexFailureInjected) return false
        indexFailureInjected = true
        return true
      })

      const ok = store.saveDraft('workflows/overflow.json', '{"id":"new"}', {
        name: 'overflow',
        isTemporary: true
      })
      expect(ok).toBe(false)
      expect(indexFailureInjected).toBe(true)

      expect(localStorage.getItem(evictedPayloadKey)).not.toBeNull()
      expect(store.getDraft('workflows/draft0.json')).not.toBeNull()
      expect(store.getDraft('workflows/overflow.json')).toBeNull()
    })
  })

  describe('handleQuotaExceeded', () => {
    function readIndexFromStorage() {
      return readIndex(WORKSPACE) ?? createEmptyIndex()
    }

    function seedDraftDirect(path: string, data: string, name: string) {
      const key = path
      localStorage.setItem(
        payloadKey(path),
        JSON.stringify({ path, data, updatedAt: Date.now() })
      )
      const index = readIndexFromStorage()
      if (!index.order.includes(key)) index.order.push(key)
      index.entries[key] = {
        path,
        name,
        isTemporary: true,
        updatedAt: Date.now()
      }
      localStorage.setItem(INDEX_KEY, JSON.stringify(index))
    }

    function injectOrphans(position: 'before' | 'after', ...keys: string[]) {
      const index = readIndexFromStorage()
      index.order =
        position === 'before'
          ? [...keys, ...index.order]
          : [...index.order, ...keys]
      localStorage.setItem(INDEX_KEY, JSON.stringify(index))
    }

    it('continues eviction past orphaned order keys with no entry', () => {
      const store = useWorkflowDraftStoreV2()

      seedDraftDirect('workflows/evictable.json', '{"id":1}', 'evictable')
      injectOrphans('before', 'deadbeef')

      failPayloadWrites(1)

      const ok = store.saveDraft('workflows/incoming.json', '{"id":"new"}', {
        name: 'incoming',
        isTemporary: true
      })
      expect(ok).toBe(true)

      expect(store.getDraft('workflows/evictable.json')).toBeNull()
      expect(store.getDraft('workflows/incoming.json')).not.toBeNull()
      expect(readIndexFromStorage().order).not.toContain('deadbeef')
    })

    it('cleans up multiple orphaned order keys preceding eviction candidates', () => {
      const store = useWorkflowDraftStoreV2()

      seedDraftDirect('workflows/a.json', '{"id":"a"}', 'a')
      seedDraftDirect('workflows/b.json', '{"id":"b"}', 'b')
      injectOrphans('before', 'orphan01', 'orphan02')

      failPayloadWrites(1)

      const ok = store.saveDraft('workflows/c.json', '{"id":"c"}', {
        name: 'c',
        isTemporary: true
      })
      expect(ok).toBe(true)

      const finalIndex = readIndexFromStorage()
      expect(finalIndex.order).not.toContain('orphan01')
      expect(finalIndex.order).not.toContain('orphan02')
      expect(store.getDraft('workflows/a.json')).toBeNull()
      expect(store.getDraft('workflows/b.json')).not.toBeNull()
      expect(store.getDraft('workflows/c.json')).not.toBeNull()
    })

    it('cleans up orphans that appear after valid eviction candidates', () => {
      const store = useWorkflowDraftStoreV2()

      seedDraftDirect('workflows/a.json', '{"id":"a"}', 'a')
      seedDraftDirect('workflows/b.json', '{"id":"b"}', 'b')
      injectOrphans('after', 'tailorphan')

      failPayloadWrites()

      const ok = store.saveDraft('workflows/c.json', '{"id":"c"}', {
        name: 'c',
        isTemporary: true
      })
      expect(ok).toBe(false)
      expect(readIndexFromStorage().order).not.toContain('tailorphan')
    })

    it('reports quota exhaustion when storage fills despite full eviction', () => {
      const store = useWorkflowDraftStoreV2()
      seedDraftDirect('workflows/a.json', '{"id":"a"}', 'a')

      failPayloadWrites()

      const ok = store.saveDraft('workflows/incoming.json', '{"id":"new"}', {
        name: 'incoming',
        isTemporary: true
      })
      expect(ok).toBe(false)

      expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), {
        errorType: 'storage_quota_exhausted',
        level: 'warning',
        tags: { store: 'workflowDraftStoreV2' },
        context: {
          evictedDrafts: 1,
          remainingDrafts: 0,
          incomingPayloadBytes: expect.any(Number)
        }
      })
    })

    it('reports payload byte size measured against the serialized envelope', () => {
      const store = useWorkflowDraftStoreV2()
      const data = '{"emoji":"🚀","note":"€"}'

      failPayloadWrites()

      store.saveDraft('workflows/multibyte.json', data, {
        name: 'mb',
        isTemporary: true
      })

      const envelope = JSON.stringify({
        path: 'workflows/multibyte.json',
        data,
        updatedAt: 0
      })
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

    it('rolls the persisted index back when the final index write fails after eviction', () => {
      const store = useWorkflowDraftStoreV2()
      seedDraftDirect('workflows/a.json', '{"id":"a"}', 'a')

      let payloadFailures = 0
      let indexFailureInjected = false
      withQuotaMock((key) => {
        if (key.startsWith(PAYLOAD_PREFIX) && payloadFailures === 0) {
          payloadFailures++
          return true
        }
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

      const persisted = readIndexFromStorage()
      expect(persisted.order).not.toContain('workflows/incoming.json')
      expect(persisted.order).not.toContain('workflows/a.json')
      expect(store.getDraft('workflows/incoming.json')).toBeNull()
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
  })
})
