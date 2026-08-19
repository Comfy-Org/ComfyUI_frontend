import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hashPath } from '../base/hashUtil'
import { StorageKeys } from '../base/storageKeys'

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

class FaultInjectingStorage implements Storage {
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

async function freshStore() {
  vi.resetModules()
  const { useWorkflowDraftStoreV2 } = await import('./workflowDraftStoreV2')
  return useWorkflowDraftStoreV2()
}

function quotaError(): DOMException {
  return new DOMException('Quota exceeded', 'QuotaExceededError')
}

describe('workflowDraftStoreV2 overwrite and rollback safety', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    realLocalStorage = globalThis.localStorage
    storage = new FaultInjectingStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true
    })
    sessionStorage.clear()
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
    const store = await freshStore()
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

  it('leaves the committed payload untouched when the metadata write fails', async () => {
    const store = await freshStore()
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
    const store = await freshStore()
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
        isTemporary: false
      })
    ).toBe(false)

    expect(payloadWrites).toBe(1)
    expect(indexWrites).toBe(2)
    expect(storage.getItem(payloadKey)).toBe(previousPayload)

    storage.writeError = () => null
    expect(store.getDraft(path)?.data).toBe('{"version":1}')
  })

  it('takes the raw rollback snapshot only after an overwrite hits quota', async () => {
    const store = await freshStore()
    const targetPath = 'workflows/target.json'
    const evictedPath = 'workflows/evicted.json'
    const targetPayloadKey = StorageKeys.draftPayload(targetPath, 'personal')

    expect(
      store.saveDraft(targetPath, '{"version":1}', {
        name: 'target',
        isTemporary: false
      })
    ).toBe(true)
    expect(
      store.saveDraft(evictedPath, '{"id":"evicted"}', {
        name: 'evicted',
        isTemporary: false
      })
    ).toBe(true)

    const getItemSpy = vi.spyOn(storage, 'getItem')
    getItemSpy.mockClear()

    let targetWrites = 0
    storage.writeError = (key) => {
      if (key === targetPayloadKey && targetWrites++ === 0) {
        return quotaError()
      }
      return null
    }

    expect(
      store.saveDraft(targetPath, '{"version":2}', {
        name: 'target',
        isTemporary: false
      })
    ).toBe(true)

    expect(getItemSpy).toHaveBeenCalledWith(targetPayloadKey)
    expect(store.getDraft(targetPath)?.data).toBe('{"version":2}')
  })

  it('retries exact target rollback after removing an uncommitted replacement', async () => {
    const store = await freshStore()
    const targetPath = 'workflows/target.json'
    const evictedPath = 'workflows/evicted.json'
    const targetPayloadKey = StorageKeys.draftPayload(targetPath, 'personal')
    const indexKey = StorageKeys.draftIndex('personal')

    expect(
      store.saveDraft(targetPath, '{"version":1}', {
        name: 'target',
        isTemporary: false
      })
    ).toBe(true)
    expect(
      store.saveDraft(evictedPath, '{"id":"evicted"}', {
        name: 'evicted',
        isTemporary: false
      })
    ).toBe(true)
    const previousPayload = storage.getItem(targetPayloadKey)!

    let targetWrites = 0
    let indexWrites = 0
    let directRollbackFailed = false
    storage.writeError = (key, value) => {
      if (key === targetPayloadKey) {
        targetWrites++
        if (targetWrites === 1) return quotaError()
        if (
          targetWrites === 3 &&
          value === previousPayload &&
          !directRollbackFailed
        ) {
          directRollbackFailed = true
          return quotaError()
        }
      }
      if (key === indexKey) {
        indexWrites++
        if (indexWrites === 4) return quotaError()
      }
      return null
    }

    expect(
      store.saveDraft(targetPath, '{"version":2}', {
        name: 'target',
        isTemporary: false
      })
    ).toBe(false)

    expect(directRollbackFailed).toBe(true)
    expect(targetWrites).toBe(4)
    expect(storage.getItem(targetPayloadKey)).toBe(previousPayload)
    expect(store.getDraft(targetPath)?.data).toBe('{"version":1}')
    expect(store.getDraft(evictedPath)?.data).toBe('{"id":"evicted"}')
  })

  it('continues quota rollback and drops target ownership when target restoration is interrupted', async () => {
    const store = await freshStore()
    const targetPath = 'workflows/target.json'
    const evictedPath = 'workflows/evicted.json'
    const targetPayloadKey = StorageKeys.draftPayload(targetPath, 'personal')
    const targetDraftKey = hashPath(targetPath)
    const evictedDraftKey = hashPath(evictedPath)
    const indexKey = StorageKeys.draftIndex('personal')

    expect(
      store.saveDraft(targetPath, '{"version":1}', {
        name: 'target',
        isTemporary: false
      })
    ).toBe(true)
    expect(
      store.saveDraft(evictedPath, '{"id":"evicted"}', {
        name: 'evicted',
        isTemporary: false
      })
    ).toBe(true)
    const previousPayload = storage.getItem(targetPayloadKey)!

    let targetWrites = 0
    let indexWrites = 0
    storage.writeError = (key, value) => {
      if (key === targetPayloadKey) {
        targetWrites++
        if (targetWrites === 1) return quotaError()
        if (targetWrites === 3 && value === previousPayload) {
          return quotaError()
        }
        if (targetWrites === 4 && value === previousPayload) {
          return new Error('rollback interrupted')
        }
      }
      if (key === indexKey) {
        indexWrites++
        if (indexWrites === 4) return quotaError()
      }
      return null
    }

    expect(
      store.saveDraft(targetPath, '{"version":2}', {
        name: 'target',
        isTemporary: false
      })
    ).toBe(false)

    storage.writeError = () => null
    const durableIndex = JSON.parse(storage.getItem(indexKey)!) as {
      order: string[]
      entries: Record<string, unknown>
    }

    expect(targetWrites).toBe(4)
    expect(storage.getItem(targetPayloadKey)).toBeNull()
    expect(durableIndex.order).not.toContain(targetDraftKey)
    expect(durableIndex.entries[targetDraftKey]).toBeUndefined()
    expect(durableIndex.order).toContain(evictedDraftKey)
    expect(durableIndex.entries[evictedDraftKey]).toBeDefined()
    expect(store.getDraft(targetPath)).toBeNull()
    expect(store.getDraft(evictedPath)?.data).toBe('{"id":"evicted"}')
  })
})
