import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_DRAFTS } from '../base/draftTypes'
import { useWorkflowDraftStore } from './workflowDraftStore'
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

    it('shadow-writes the legacy draft store', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/test.json', '{"nodes":[]}', {
        name: 'test',
        isTemporary: true
      })

      expect(
        useWorkflowDraftStore().getDraft('workflows/test.json')
      ).toMatchObject({
        data: '{"nodes":[]}',
        name: 'test',
        isTemporary: true
      })
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

    it('returns true when V2 saves and legacy shadow-write fails', () => {
      const store = useWorkflowDraftStoreV2()
      const legacyStore = useWorkflowDraftStore()
      vi.spyOn(legacyStore, 'saveDraft').mockImplementation(() => {
        throw new Error('legacy unavailable')
      })

      const result = store.saveDraft('workflows/test.json', '{}', {
        name: 'test',
        isTemporary: true
      })

      expect(result).toBe(true)
      expect(store.getDraft('workflows/test.json')?.data).toBe('{}')
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
      expect(
        useWorkflowDraftStore().getDraft('workflows/test.json')
      ).toBeUndefined()
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

      const legacyStore = useWorkflowDraftStore()
      expect(legacyStore.getDraft('workflows/old.json')).toBeUndefined()
      expect(legacyStore.getDraft('workflows/new.json')).toMatchObject({
        name: 'new',
        data: '{"data":"test"}'
      })
    })
  })

  describe('getDraft', () => {
    it('prefers legacy draft content when it is newer than V2', () => {
      const store = useWorkflowDraftStoreV2()
      const path = 'workflows/test.json'

      store.saveDraft(path, '{"source":"v2"}', {
        name: 'test',
        isTemporary: true
      })
      useWorkflowDraftStore().saveDraft(path, {
        data: '{"source":"legacy"}',
        updatedAt: Date.now() + 1000,
        name: 'test',
        isTemporary: true
      })

      expect(store.getDraft(path)?.data).toBe('{"source":"legacy"}')
    })

    it('returns null when legacy fallback read fails', () => {
      const store = useWorkflowDraftStoreV2()
      const legacyStore = useWorkflowDraftStore()
      vi.spyOn(legacyStore, 'getDraft').mockImplementation(() => {
        throw new Error('legacy unavailable')
      })

      expect(store.getDraft('workflows/missing.json')).toBeNull()
    })

    it('cleans up the V2 index when a payload is missing', () => {
      const store = useWorkflowDraftStoreV2()
      const path = 'workflows/missing-payload.json'
      store.saveDraft(path, '{"nodes":[]}', {
        name: 'missing-payload',
        isTemporary: true
      })
      useWorkflowDraftStore().removeDraft(path)

      const payloadKey = Object.keys(localStorage).find((key) =>
        key.startsWith('Comfy.Workflow.Draft.v2:personal:')
      )
      expect(payloadKey).toBeDefined()
      localStorage.removeItem(payloadKey!)

      expect(store.getDraft(path)).toBeNull()
      const index = JSON.parse(
        localStorage.getItem('Comfy.Workflow.DraftIndex.v2:personal')!
      )
      expect(index.order).toHaveLength(0)
    })
  })

  describe('markDraftUsed', () => {
    it('updates the V2 recency order', () => {
      const store = useWorkflowDraftStoreV2()

      store.saveDraft('workflows/a.json', '{}', {
        name: 'a',
        isTemporary: true
      })
      store.saveDraft('workflows/b.json', '{}', {
        name: 'b',
        isTemporary: true
      })

      store.markDraftUsed('workflows/a.json')

      expect(store.getMostRecentPath()).toBe('workflows/a.json')
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

    it('falls back to legacy drafts when V2 has no matching draft', async () => {
      const store = useWorkflowDraftStoreV2()
      useWorkflowDraftStore().saveDraft('workflows/legacy.json', {
        data: '{"nodes":[]}',
        updatedAt: Date.now(),
        name: 'legacy',
        isTemporary: true
      })

      const result = await store.loadPersistedWorkflow({
        workflowName: null,
        preferredPath: 'workflows/legacy.json'
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

    it('removes an invalid persisted draft after load fails', async () => {
      const store = useWorkflowDraftStoreV2()
      const path = 'workflows/bad.json'
      store.saveDraft(path, 'not-json', {
        name: 'bad',
        isTemporary: true
      })

      const result = await store.loadPersistedWorkflow({
        workflowName: null,
        preferredPath: path
      })

      expect(result).toBe(false)
      expect(store.getDraft(path)).toBeNull()
    })

    it('returns false for an empty persisted draft payload', async () => {
      const store = useWorkflowDraftStoreV2()
      const path = 'workflows/empty.json'
      store.saveDraft(path, '', {
        name: 'empty',
        isTemporary: true
      })

      const result = await store.loadPersistedWorkflow({
        workflowName: null,
        preferredPath: path
      })

      expect(result).toBe(false)
    })

    it('returns false when legacy persisted workflow fallback throws', async () => {
      const store = useWorkflowDraftStoreV2()
      const legacyStore = useWorkflowDraftStore()
      vi.spyOn(legacyStore, 'loadPersistedWorkflow').mockImplementation(() => {
        throw new Error('legacy unavailable')
      })

      const result = await store.loadPersistedWorkflow({
        workflowName: null,
        preferredPath: 'workflows/missing.json'
      })

      expect(result).toBe(false)
    })

    it('does not use legacy persisted workflow fallback outside personal workspace', async () => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ id: 'workspace-1', type: 'org' })
      )
      const store = useWorkflowDraftStoreV2()
      const legacyStore = useWorkflowDraftStore()
      const legacyLoad = vi.spyOn(legacyStore, 'loadPersistedWorkflow')

      const result = await store.loadPersistedWorkflow({
        workflowName: null,
        preferredPath: 'workflows/missing.json'
      })

      expect(result).toBe(false)
      expect(legacyLoad).not.toHaveBeenCalled()
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
