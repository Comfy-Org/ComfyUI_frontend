import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_DRAFTS } from '../base/draftTypes'
import { hashPath } from '../base/hashUtil'
import { resetStorageAvailable } from '../base/storageIO'
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

const captureMessageMock = vi.hoisted(() => vi.fn())
vi.mock('@sentry/vue', () => ({
  captureMessage: captureMessageMock
}))

function quotaError(): DOMException {
  const err = new DOMException('Quota exceeded', 'QuotaExceededError')
  return err
}

describe('workflowDraftStoreV2', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    localStorage.clear()
    sessionStorage.clear()
    resetStorageAvailable()
    vi.clearAllMocks()
  })

  afterEach(() => {
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

      // Verify index exists
      const indexKey = 'Comfy.Workflow.DraftIndex.v2:personal'
      const indexJson = localStorage.getItem(indexKey)
      expect(indexJson).not.toBeNull()

      const index = JSON.parse(indexJson!)
      expect(index.v).toBe(2)
      expect(index.order).toHaveLength(1)

      // Verify payload exists separately
      const payloadKeys = Object.keys(localStorage).filter((k) =>
        k.startsWith('Comfy.Workflow.Draft.v2:personal:')
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
  })

  describe('handleQuotaExceeded', () => {
    const indexKey = 'Comfy.Workflow.DraftIndex.v2:personal'
    const payloadPrefix = 'Comfy.Workflow.Draft.v2:personal:'

    function seedDraftDirect(path: string, data: string, name: string) {
      const key = hashPath(path)
      localStorage.setItem(
        `${payloadPrefix}${key}`,
        JSON.stringify({ data, updatedAt: Date.now() })
      )
      const json = localStorage.getItem(indexKey)
      const index = json
        ? JSON.parse(json)
        : { v: 2, updatedAt: Date.now(), order: [], entries: {} }
      if (!index.order.includes(key)) index.order.push(key)
      index.entries[key] = {
        path,
        name,
        isTemporary: true,
        updatedAt: Date.now()
      }
      localStorage.setItem(indexKey, JSON.stringify(index))
    }

    function injectOrphanedOrderKeys(...orphanKeys: string[]) {
      const json = localStorage.getItem(indexKey)
      const index = json
        ? JSON.parse(json)
        : { v: 2, updatedAt: Date.now(), order: [], entries: {} }
      index.order = [...orphanKeys, ...index.order]
      localStorage.setItem(indexKey, JSON.stringify(index))
    }

    function spyQuotaOnPayloadWrite(failTimes = Infinity) {
      const realSetItem = localStorage.setItem.bind(localStorage)
      let failed = 0
      return vi
        .spyOn(localStorage, 'setItem')
        .mockImplementation((key: string, value: string) => {
          if (key.startsWith(payloadPrefix) && failed < failTimes) {
            failed++
            throw quotaError()
          }
          return realSetItem(key, value)
        })
    }

    it('continues eviction past orphaned order keys with no entry', () => {
      const store = useWorkflowDraftStoreV2()

      seedDraftDirect('workflows/evictable.json', '{"id":1}', 'evictable')
      const desyncedKey = 'deadbeef'
      injectOrphanedOrderKeys(desyncedKey)

      const setItemSpy = spyQuotaOnPayloadWrite(1)
      try {
        const ok = store.saveDraft('workflows/incoming.json', '{"id":"new"}', {
          name: 'incoming',
          isTemporary: true
        })
        expect(ok).toBe(true)
      } finally {
        setItemSpy.mockRestore()
      }

      expect(store.getDraft('workflows/evictable.json')).toBeNull()
      expect(store.getDraft('workflows/incoming.json')).not.toBeNull()

      const finalIndex = JSON.parse(localStorage.getItem(indexKey)!)
      expect(finalIndex.order).not.toContain(desyncedKey)
    })

    it('cleans up multiple orphaned order keys preceding eviction candidates', () => {
      const store = useWorkflowDraftStoreV2()

      seedDraftDirect('workflows/a.json', '{"id":"a"}', 'a')
      seedDraftDirect('workflows/b.json', '{"id":"b"}', 'b')
      injectOrphanedOrderKeys('orphan01', 'orphan02')

      const setItemSpy = spyQuotaOnPayloadWrite(1)
      try {
        const ok = store.saveDraft('workflows/c.json', '{"id":"c"}', {
          name: 'c',
          isTemporary: true
        })
        expect(ok).toBe(true)
      } finally {
        setItemSpy.mockRestore()
      }

      const finalIndex = JSON.parse(localStorage.getItem(indexKey)!)
      expect(finalIndex.order).not.toContain('orphan01')
      expect(finalIndex.order).not.toContain('orphan02')
      expect(store.getDraft('workflows/a.json')).toBeNull()
      expect(store.getDraft('workflows/b.json')).not.toBeNull()
      expect(store.getDraft('workflows/c.json')).not.toBeNull()
    })

    it('reports to Sentry when storage fills despite full eviction', () => {
      const store = useWorkflowDraftStoreV2()
      seedDraftDirect('workflows/a.json', '{"id":"a"}', 'a')

      const setItemSpy = spyQuotaOnPayloadWrite()
      try {
        const ok = store.saveDraft('workflows/incoming.json', '{"id":"new"}', {
          name: 'incoming',
          isTemporary: true
        })
        expect(ok).toBe(false)
      } finally {
        setItemSpy.mockRestore()
      }

      expect(captureMessageMock).toHaveBeenCalledWith(
        expect.stringContaining('localStorage quota exhausted'),
        expect.objectContaining({
          level: 'warning',
          tags: expect.objectContaining({
            error_type: 'storage_quota_exhausted',
            store: 'workflowDraftStoreV2'
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

      // Verify payload is deleted
      const payloadKeys = Object.keys(localStorage).filter((k) =>
        k.startsWith('Comfy.Workflow.Draft.v2:personal:')
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
        workflowName: 'test',
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
        workflowName: null,
        preferredPath: 'workflows/missing.json',
        fallbackToLatestDraft: true
      })

      expect(result).toBe(true)
    })

    it('returns false when no drafts available', async () => {
      const store = useWorkflowDraftStoreV2()

      const result = await store.loadPersistedWorkflow({
        workflowName: null,
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
