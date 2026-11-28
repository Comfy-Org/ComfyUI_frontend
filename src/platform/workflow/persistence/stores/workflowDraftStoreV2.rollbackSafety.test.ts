import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useApp } from '@/scripts/appInstance'
import {
  prepareWorkflowLogoutTransition,
  resetStorageAvailable
} from '@/platform/workflow/persistence/base/storageIO'
import { hashPath } from '@/platform/workflow/persistence/base/hashUtil'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { useWorkflowDraftStoreV2 } from './workflowDraftStoreV2'

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    clientId: 'test-client',
    initialClientId: 'test-client'
  }
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    loadGraphData: vi.fn().mockResolvedValue(undefined)
  }
}))

class FaultInjectingStorage implements Storage {
  [key: string]: unknown

  readonly map = new Map<string, string>()
  writeError: (key: string, value: string) => Error | null = () => null

  get length(): number {
    return this.map.size
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    const error = this.writeError(key, value)
    if (error) throw error
    this.map.set(key, value)
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }
}

let storage: FaultInjectingStorage
let realLocalStorage: Storage

function quotaError(): DOMException {
  return new DOMException('Quota exceeded', 'QuotaExceededError')
}

describe('workflowDraftStoreV2 overwrite and rollback safety', () => {
  beforeEach(() => {
    realLocalStorage = globalThis.localStorage
    storage = new FaultInjectingStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true
    })
    sessionStorage.clear()
    resetStorageAvailable()
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: realLocalStorage,
      configurable: true,
      writable: true
    })
    localStorage.clear()
    sessionStorage.clear()
  })

  it('does not read the existing workflow payload on a successful overwrite', async () => {
    const store = useWorkflowDraftStoreV2()
    const path = 'workflows/target.json'
    const payloadKey = StorageKeys.draftPayload(path, 'personal')

    expect(
      store.saveDraft(path, '{"version":1}', {
        name: 'target',
        isTemporary: false
      })
    ).toBe(true)

    const getItemSpy = vi.spyOn(storage, 'getItem')
    getItemSpy.mockClear()

    expect(
      store.saveDraft(path, '{"version":2}', {
        name: 'target',
        isTemporary: false
      })
    ).toBe(true)

    expect(getItemSpy).not.toHaveBeenCalledWith(payloadKey)
    expect(store.getDraft(path)?.data).toBe('{"version":2}')
  })

  it('preserves the prior CRDT lineage after a cold-cache overwrite', () => {
    const store = useWorkflowDraftStoreV2()
    const path = 'workflows/lineage-target.json'
    const meta = { name: 'lineage-target', isTemporary: false }
    const lineage = { workflowId: 'workflow-identity', lineageSeq: 7 }

    expect(store.saveDraft(path, '{"version":1}', meta)).toBe(true)
    store.setLineage(path, lineage)
    store.reset()

    expect(store.saveDraft(path, '{"version":2}', meta)).toBe(true)
    expect(store.getDraft(path)).toMatchObject({
      data: '{"version":2}',
      lineage
    })

    const payloadKey = StorageKeys.draftPayload(path, 'personal')
    const getItemSpy = vi.spyOn(storage, 'getItem')
    getItemSpy.mockClear()
    expect(store.saveDraft(path, '{"version":3}', meta)).toBe(true)
    expect(getItemSpy).not.toHaveBeenCalledWith(payloadKey)
  })

  it('leaves the committed payload untouched when the metadata write fails', async () => {
    const store = useWorkflowDraftStoreV2()
    const path = 'workflows/target.json'
    const payloadKey = StorageKeys.draftPayload(path, 'personal')
    const indexKey = StorageKeys.draftIndex('personal')

    expect(
      store.saveDraft(path, '{"version":1}', {
        name: 'target',
        isTemporary: false
      })
    ).toBe(true)
    const previousPayload = storage.getItem(payloadKey)!

    storage.writeError = (key) => (key === indexKey ? quotaError() : null)

    expect(
      store.saveDraft(path, '{"version":2}', {
        name: 'target',
        isTemporary: false
      })
    ).toBe(false)

    expect(storage.getItem(payloadKey)).toBe(previousPayload)
    storage.writeError = () => null
    expect(store.getDraft(path)?.data).toBe('{"version":1}')
  })

  it('keeps the old payload recoverable if restoring metadata after quota failure also fails', async () => {
    const store = useWorkflowDraftStoreV2()
    const path = 'workflows/target.json'
    const payloadKey = StorageKeys.draftPayload(path, 'personal')
    const indexKey = StorageKeys.draftIndex('personal')

    expect(
      store.saveDraft(path, '{"version":1}', {
        name: 'target',
        isTemporary: false,
        isModified: true
      })
    ).toBe(true)
    const previousPayload = storage.getItem(payloadKey)!

    let payloadWrites = 0
    let indexWrites = 0
    storage.writeError = (key) => {
      if (key === indexKey) {
        indexWrites++
        if (indexWrites === 2) return quotaError()
      }
      if (key === payloadKey) {
        payloadWrites++
        if (payloadWrites === 1) return quotaError()
      }
      return null
    }

    expect(
      store.saveDraft(path, '{"version":2}', {
        name: 'target',
        isTemporary: false,
        isModified: false
      })
    ).toBe(false)

    expect(payloadWrites).toBeGreaterThan(0)
    expect(indexWrites).toBeGreaterThan(1)
    expect(storage.getItem(payloadKey)).toBe(previousPayload)

    storage.writeError = () => null
    expect(store.getDraft(path)).toMatchObject({
      data: '{"version":1}',
      isModified: true
    })
  })

  it('refuses an indexed overwrite without deleting other drafts and retries later', () => {
    const store = useWorkflowDraftStoreV2()
    const meta = { name: 'target', isTemporary: false }
    expect(
      store.saveDraft('workflows/other.json', '{"id":"other"}', meta)
    ).toBe(true)
    expect(
      store.saveDraft('workflows/target.json', '{"id":"old"}', meta)
    ).toBe(true)
    const before = new Map(storage.map)
    const key = StorageKeys.draftPayload('workflows/target.json', 'personal')
    storage.writeError = (path) => (path === key ? quotaError() : null)
    expect(
      store.saveDraft('workflows/target.json', '{"id":"new"}', meta)
    ).toBe(false)
    expect(storage.map).toEqual(before)
    storage.writeError = () => null
    expect(
      store.saveDraft('workflows/target.json', '{"id":"new"}', meta)
    ).toBe(true)
    expect(store.getDraft('workflows/other.json')?.data).toBe('{"id":"other"}')
  })

  it('keeps both colliding drafts intact when an indexed overwrite fails', () => {
    const store = useWorkflowDraftStoreV2()
    const first = 'workflows/ewip.json'
    const second = 'workflows/4hbab.json'
    const meta = { name: 'draft', isTemporary: false, isModified: true }
    expect(hashPath(first)).toBe(hashPath(second))
    expect(store.saveDraft(first, '{"id":1}', meta)).toBe(true)
    expect(store.saveDraft(second, '{"id":2}', meta)).toBe(true)
    const before = new Map(storage.map)
    const indexKey = StorageKeys.draftIndex('personal')
    storage.writeError = (key) => (key === indexKey ? quotaError() : null)

    expect(store.saveDraft(second, '{"id":3}', meta)).toBe(false)
    expect(storage.map).toEqual(before)
    expect(store.getDraft(first)?.data).toBe('{"id":1}')
    expect(store.getDraft(second)?.data).toBe('{"id":2}')
  })

  it('does not replace the cached owner or payload on a failed rename', () => {
    const store = useWorkflowDraftStoreV2()
    const from = 'workflows/original.json'
    const to = 'workflows/renamed.json'
    const meta = { name: 'original', isTemporary: false, isModified: true }
    expect(store.saveDraft(from, '{"id":1}', meta)).toBe(true)
    const before = new Map(storage.map)
    const indexKey = StorageKeys.draftIndex('personal')
    storage.writeError = (key) => (key === indexKey ? quotaError() : null)

    store.moveDraft(from, to, 'renamed')
    expect(storage.map).toEqual(before)
    expect(store.getDraft(from)?.data).toBe('{"id":1}')
    expect(store.getDraft(to)).toBeNull()

    storage.writeError = () => null
    store.moveDraft(from, to, 'renamed')
    expect(store.getDraft(from)).toBeNull()
    expect(store.getDraft(to)?.data).toBe('{"id":1}')
    expect(storage.getItem(StorageKeys.draftPayload(from, 'personal'))).toBe(
      before.get(StorageKeys.draftPayload(from, 'personal'))
    )
  })

  it('does not cache an empty index during an aborted identity transition', () => {
    const store = useWorkflowDraftStoreV2()
    const first = 'workflows/first.json'
    const second = 'workflows/second.json'
    const meta = { name: 'draft', isTemporary: false }
    expect(store.saveDraft(first, '{"id":1}', meta)).toBe(true)
    expect(store.saveDraft(second, '{"id":2}', meta)).toBe(true)
    store.reset()

    const fence = prepareWorkflowLogoutTransition()
    try {
      expect(store.getDraft(first)).toBeNull()
    } finally {
      fence.release()
    }

    expect(store.saveDraft(first, '{"id":3}', meta)).toBe(true)
    expect(store.getDraft(first)?.data).toBe('{"id":3}')
    expect(store.getDraft(second)?.data).toBe('{"id":2}')
  })

  it('does not delete another identity’s draft when a pending restore fails', async () => {
    const store = useWorkflowDraftStoreV2()
    const path = 'workflows/shared.json'
    const meta = { name: 'shared', isTemporary: true }
    store.setAuthSubject('first')
    expect(store.saveDraft(path, '{"id":1}', meta)).toBe(true)
    let rejectLoad!: (error: Error) => void
    const pending = new Promise<undefined>((_, reject) => {
      rejectLoad = reject
    })
    vi.mocked(useApp().loadGraphData).mockImplementationOnce(() => pending)

    const restore = store.loadPersistedWorkflow({
      preferredPath: path,
      fallbackToLatestDraft: true
    })
    store.setAuthSubject('second')
    expect(store.saveDraft(path, '{"id":2}', meta)).toBe(true)
    rejectLoad(new Error('Restore interrupted'))
    expect(await restore).toBe(false)
    expect(store.getDraft(path)?.data).toBe('{"id":2}')
    store.setAuthSubject('first')
    expect(store.getDraft(path)?.data).toBe('{"id":1}')
  })

  it('restores exact orphan bytes when a fresh-index checkpoint fails', () => {
    const store = useWorkflowDraftStoreV2()
    const meta = { name: 'target', isTemporary: false }
    expect(store.saveDraft('workflows/other.json', '{}', meta)).toBe(true)
    const path = 'workflows/target.json'
    const key = StorageKeys.draftPayload(path, 'personal')
    const original = '{ "data": "{}", "updatedAt": 1 }'
    storage.setItem(key, original)
    const before = new Map(storage.map)
    storage.writeError = (path) =>
      path === StorageKeys.draftIndex('personal') ? quotaError() : null
    expect(
      store.saveDraft(path, '{"id":"new"}', meta, { evict: false })
    ).toBe(false)
    expect(storage.map).toEqual(before)
  })
})
