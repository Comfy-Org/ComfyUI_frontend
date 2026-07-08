import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_DRAFTS } from '../base/draftTypes'
import { StorageKeys } from '../base/storageKeys'
import { useWorkflowDraftStoreV2 } from './workflowDraftStoreV2'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import { app as comfyApp } from '@/scripts/app'

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

describe('workflowDraftStoreV2', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    localStorage.clear()
    sessionStorage.clear()
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
      expect(draft!.updatedAt).toEqual(expect.any(Number))
    })

    it('keeps payload updatedAt stable when only recency is refreshed', () => {
      vi.useFakeTimers()

      try {
        const store = useWorkflowDraftStoreV2()

        vi.setSystemTime(new Date('2026-03-21T10:00:00Z'))
        store.saveDraft('workflows/a.json', '{"id":"a"}', {
          name: 'a',
          isTemporary: true
        })
        const initialUpdatedAt = store.getDraft('workflows/a.json')!.updatedAt

        vi.setSystemTime(new Date('2026-03-21T10:01:00Z'))
        store.saveDraft('workflows/b.json', '{"id":"b"}', {
          name: 'b',
          isTemporary: true
        })
        expect(store.getMostRecentPath()).toBe('workflows/b.json')

        vi.setSystemTime(new Date('2026-03-21T10:02:00Z'))
        store.markDraftUsed('workflows/a.json')

        expect(store.getDraft('workflows/a.json')!.updatedAt).toBe(
          initialUpdatedAt
        )
        expect(store.getMostRecentPath()).toBe('workflows/a.json')
      } finally {
        vi.useRealTimers()
      }
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

      const originalSetItem = localStorage.setItem.bind(localStorage)
      const newDraftPayloadKey = StorageKeys.draftPayload(
        'workflows/new.json',
        'personal'
      )
      let quotaFailureInjected = false
      const setItemSpy = vi
        .spyOn(localStorage, 'setItem')
        .mockImplementation((key: string, value: string) => {
          if (key === newDraftPayloadKey && !quotaFailureInjected) {
            quotaFailureInjected = true
            throw new DOMException('Quota exceeded', 'QuotaExceededError')
          }

          return originalSetItem(key, value)
        })

      try {
        const result = store.saveDraft('workflows/new.json', '{"id":"new"}', {
          name: 'new',
          isTemporary: true
        })

        expect(result).toBe(true)
        expect(quotaFailureInjected).toBe(true)
        expect(store.getDraft('workflows/draft0.json')).toBeNull()
        expect(store.getDraft('workflows/new.json')?.data).toBe('{"id":"new"}')
      } finally {
        setItemSpy.mockRestore()
      }
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

    it('ignores missing drafts', () => {
      const store = useWorkflowDraftStoreV2()

      expect(() => store.removeDraft('workflows/missing.json')).not.toThrow()
      expect(store.getDraft('workflows/missing.json')).toBeNull()
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
      vi.useFakeTimers()

      try {
        const store = useWorkflowDraftStoreV2()

        vi.setSystemTime(new Date('2026-05-13T00:00:00Z'))
        store.saveDraft('workflows/old.json', '{"data":"test"}', {
          name: 'old',
          isTemporary: true
        })
        const originalUpdatedAt =
          store.getDraft('workflows/old.json')!.updatedAt

        vi.setSystemTime(new Date('2026-05-13T00:05:00Z'))
        store.moveDraft('workflows/old.json', 'workflows/new.json', 'new')

        expect(store.getDraft('workflows/new.json')!.updatedAt).toBe(
          originalUpdatedAt
        )
      } finally {
        vi.useRealTimers()
      }
    })

    it('ignores missing source drafts', () => {
      const store = useWorkflowDraftStoreV2()

      store.moveDraft('workflows/missing.json', 'workflows/new.json', 'new')

      expect(store.getDraft('workflows/new.json')).toBeNull()
    })

    it('does not move when the old payload is missing', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/old.json', '{"data":"test"}', {
        name: 'old',
        isTemporary: true
      })
      localStorage.removeItem(
        StorageKeys.draftPayload('workflows/old.json', 'personal')
      )
      store.reset()

      store.moveDraft('workflows/old.json', 'workflows/new.json', 'new')

      expect(store.getDraft('workflows/new.json')).toBeNull()
    })

    it('keeps the original draft when writing the moved payload fails', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/old.json', '{"data":"test"}', {
        name: 'old',
        isTemporary: true
      })

      const originalSetItem = localStorage.setItem.bind(localStorage)
      const newPayloadKey = StorageKeys.draftPayload(
        'workflows/new.json',
        'personal'
      )
      const setItemSpy = vi
        .spyOn(localStorage, 'setItem')
        .mockImplementation((key: string, value: string) => {
          if (key === newPayloadKey) {
            throw new DOMException('Quota exceeded', 'QuotaExceededError')
          }
          return originalSetItem(key, value)
        })

      try {
        store.moveDraft('workflows/old.json', 'workflows/new.json', 'new')

        expect(store.getDraft('workflows/old.json')).not.toBeNull()
        expect(store.getDraft('workflows/new.json')).toBeNull()
      } finally {
        setItemSpy.mockRestore()
      }
    })

    it('removes the moved payload when persisting the moved index fails', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/old.json', '{"data":"test"}', {
        name: 'old',
        isTemporary: true
      })

      const originalSetItem = localStorage.setItem.bind(localStorage)
      const indexKey = StorageKeys.draftIndex('personal')
      const newPayloadKey = StorageKeys.draftPayload(
        'workflows/new.json',
        'personal'
      )
      const setItemSpy = vi
        .spyOn(localStorage, 'setItem')
        .mockImplementation((key: string, value: string) => {
          if (key === indexKey) {
            throw new DOMException('Quota exceeded', 'QuotaExceededError')
          }
          return originalSetItem(key, value)
        })

      try {
        store.moveDraft('workflows/old.json', 'workflows/new.json', 'new')

        expect(localStorage.getItem(newPayloadKey)).toBeNull()
      } finally {
        setItemSpy.mockRestore()
      }
    })
  })

  describe('getDraft', () => {
    it('removes stale index entries when the payload is missing', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/test.json', '{"nodes":[]}', {
        name: 'test',
        isTemporary: true
      })
      localStorage.removeItem(
        StorageKeys.draftPayload('workflows/test.json', 'personal')
      )
      store.reset()

      expect(store.getDraft('workflows/test.json')).toBeNull()
      expect(store.getMostRecentPath()).toBeNull()
    })
  })

  describe('markDraftUsed', () => {
    it('ignores unknown draft paths', () => {
      const store = useWorkflowDraftStoreV2()

      expect(() => store.markDraftUsed('workflows/missing.json')).not.toThrow()
      expect(store.getMostRecentPath()).toBeNull()
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

    it('returns null when the newest index key has no entry', () => {
      const indexKey = StorageKeys.draftIndex('personal')
      localStorage.setItem(
        indexKey,
        JSON.stringify({
          v: 2,
          updatedAt: Date.now(),
          order: ['missing'],
          entries: {}
        })
      )
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

    it('loads legacy session workflow payloads in personal workspace', async () => {
      const store = useWorkflowDraftStoreV2()
      sessionStorage.setItem('workflow:test-client', '{"nodes":[]}')

      const result = await store.loadPersistedWorkflow({
        workflowName: 'legacy'
      })

      expect(result).toBe(true)
      expect(comfyApp.loadGraphData).toHaveBeenCalledWith(
        { nodes: [] },
        true,
        true,
        'legacy'
      )
    })

    it('falls back to legacy local workflow payloads in personal workspace', async () => {
      const store = useWorkflowDraftStoreV2()
      localStorage.setItem('workflow', '{"nodes":[1]}')

      const result = await store.loadPersistedWorkflow({
        workflowName: null
      })

      expect(result).toBe(true)
      expect(comfyApp.loadGraphData).toHaveBeenCalledWith(
        { nodes: [1] },
        true,
        true,
        null
      )
    })

    it('does not load legacy payloads for non-personal workspaces', async () => {
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify({ id: 'team-1', type: 'organization' })
      )
      sessionStorage.setItem('workflow:test-client', '{"nodes":[]}')
      localStorage.setItem('workflow', '{"nodes":[]}')
      const store = useWorkflowDraftStoreV2()

      const result = await store.loadPersistedWorkflow({
        workflowName: 'team'
      })

      expect(result).toBe(false)
      expect(comfyApp.loadGraphData).not.toHaveBeenCalled()
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
