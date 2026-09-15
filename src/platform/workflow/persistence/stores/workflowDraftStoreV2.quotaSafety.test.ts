import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_DRAFTS } from '../base/draftTypes'
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

class FakeStorage implements Storage {
  [key: string]: unknown

  readonly map = new Map<string, string>()
  shouldFailWrite: (key: string, value: string) => boolean = () => false

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
    if (this.shouldFailWrite(key, value)) {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }
    this.map.set(key, value)
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }
}

let fakeStorage: FakeStorage
let realLocalStorage: Storage

async function freshStore() {
  vi.resetModules()
  const { useWorkflowDraftStoreV2 } = await import('./workflowDraftStoreV2')
  return useWorkflowDraftStoreV2()
}

describe('workflowDraftStoreV2 quota safety', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    realLocalStorage = globalThis.localStorage
    fakeStorage = new FakeStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      value: fakeStorage,
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

  it('restores existing draft history when an incoming draft can never fit', async () => {
    const store = await freshStore()
    expect(
      store.saveDraft('workflows/a.json', '{"id":"a"}', {
        name: 'a',
        isTemporary: false
      })
    ).toBe(true)
    expect(
      store.saveDraft('workflows/b.json', '{"id":"b"}', {
        name: 'b',
        isTemporary: false
      })
    ).toBe(true)

    const targetKey = StorageKeys.draftPayload(
      'workflows/too-large.json',
      'personal'
    )
    fakeStorage.shouldFailWrite = (key) => key === targetKey

    expect(
      store.saveDraft('workflows/too-large.json', 'x'.repeat(1024), {
        name: 'too-large',
        isTemporary: false
      })
    ).toBe(false)

    expect(store.getDraft('workflows/a.json')?.data).toBe('{"id":"a"}')
    expect(store.getDraft('workflows/b.json')?.data).toBe('{"id":"b"}')
    expect(store.getDraft('workflows/too-large.json')).toBeNull()
  })

  it('persists again after a transient quota failure without reloading', async () => {
    const store = await freshStore()
    const failingKey = StorageKeys.draftPayload(
      'workflows/blocked.json',
      'personal'
    )
    fakeStorage.shouldFailWrite = (key) => key === failingKey

    expect(
      store.saveDraft('workflows/blocked.json', 'x'.repeat(64), {
        name: 'blocked',
        isTemporary: false
      })
    ).toBe(false)

    fakeStorage.shouldFailWrite = () => false

    expect(
      store.saveDraft('workflows/recovered.json', '{"nodes":[]}', {
        name: 'recovered',
        isTemporary: true
      })
    ).toBe(true)
    expect(store.getDraft('workflows/recovered.json')?.data).toBe(
      '{"nodes":[]}'
    )
  })

  it('restores the previous payload when an index update hits quota', async () => {
    const store = await freshStore()
    expect(
      store.saveDraft('workflows/a.json', '{"version":1}', {
        name: 'a',
        isTemporary: false
      })
    ).toBe(true)

    const indexKey = StorageKeys.draftIndex('personal')
    let failNextIndexWrite = true
    fakeStorage.shouldFailWrite = (key) => {
      if (key !== indexKey || !failNextIndexWrite) return false
      failNextIndexWrite = false
      return true
    }

    expect(
      store.saveDraft('workflows/a.json', '{"version":2}', {
        name: 'a',
        isTemporary: false
      })
    ).toBe(false)

    expect(store.getDraft('workflows/a.json')?.data).toBe('{"version":1}')
  })

  it('restores prior evictions when a later eviction-index write fails', async () => {
    const store = await freshStore()
    expect(
      store.saveDraft('workflows/a.json', '{"id":"a"}', {
        name: 'a',
        isTemporary: false
      })
    ).toBe(true)
    expect(
      store.saveDraft('workflows/b.json', '{"id":"b"}', {
        name: 'b',
        isTemporary: false
      })
    ).toBe(true)

    const targetKey = StorageKeys.draftPayload(
      'workflows/incoming.json',
      'personal'
    )
    const indexKey = StorageKeys.draftIndex('personal')
    let targetAttempts = 0
    let evictionIndexWrites = 0
    fakeStorage.shouldFailWrite = (key) => {
      if (key === targetKey) {
        targetAttempts++
        return true
      }
      if (key === indexKey) {
        evictionIndexWrites++
        return evictionIndexWrites === 2
      }
      return false
    }

    expect(
      store.saveDraft('workflows/incoming.json', 'x'.repeat(1024), {
        name: 'incoming',
        isTemporary: false
      })
    ).toBe(false)

    expect(targetAttempts).toBeGreaterThan(1)
    expect(store.getDraft('workflows/a.json')?.data).toBe('{"id":"a"}')
    expect(store.getDraft('workflows/b.json')?.data).toBe('{"id":"b"}')
    expect(store.getDraft('workflows/incoming.json')).toBeNull()
  })

  it('restores prior evictions when the final incoming index cannot commit', async () => {
    const store = await freshStore()
    expect(
      store.saveDraft('workflows/a.json', '{"id":"a"}', {
        name: 'a',
        isTemporary: false
      })
    ).toBe(true)
    expect(
      store.saveDraft('workflows/b.json', '{"id":"b"}', {
        name: 'b',
        isTemporary: false
      })
    ).toBe(true)

    const targetPath = 'workflows/incoming.json'
    const targetKey = StorageKeys.draftPayload(targetPath, 'personal')
    const targetDraftKey = hashPath(targetPath)
    const indexKey = StorageKeys.draftIndex('personal')
    let targetWrites = 0
    fakeStorage.shouldFailWrite = (key, value) => {
      if (key === targetKey) {
        targetWrites++
        return targetWrites === 1
      }
      if (key === indexKey) {
        const index = JSON.parse(value) as {
          entries: Partial<Record<string, unknown>>
        }
        return Boolean(index.entries[targetDraftKey])
      }
      return false
    }

    expect(
      store.saveDraft(targetPath, '{"id":"incoming"}', {
        name: 'incoming',
        isTemporary: false
      })
    ).toBe(false)

    expect(targetWrites).toBeGreaterThan(1)
    expect(store.getDraft('workflows/a.json')?.data).toBe('{"id":"a"}')
    expect(store.getDraft('workflows/b.json')?.data).toBe('{"id":"b"}')
    expect(store.getDraft(targetPath)).toBeNull()
  })

  it('rolls back the payload under the exact key removed from a drifted index', async () => {
    const path = 'workflows/a.json'
    const actualKey = hashPath(path)
    const staleKey = actualKey === 'deadbeef' ? 'feedface' : 'deadbeef'
    const indexKey = StorageKeys.draftIndex('personal')
    const payloadPrefix = `${StorageKeys.prefixes.draftPayload}personal:`

    fakeStorage.setItem(
      indexKey,
      JSON.stringify({
        v: 2,
        updatedAt: 1,
        order: [staleKey, actualKey],
        entries: {
          [staleKey]: {
            path,
            name: 'stale-alias',
            isTemporary: false,
            updatedAt: 1
          },
          [actualKey]: {
            path,
            name: 'a',
            isTemporary: false,
            updatedAt: 2
          }
        }
      })
    )
    fakeStorage.setItem(
      `${payloadPrefix}${staleKey}`,
      JSON.stringify({ data: '{"id":"wrong"}', updatedAt: 1 })
    )
    fakeStorage.setItem(
      `${payloadPrefix}${actualKey}`,
      JSON.stringify({ data: '{"id":"correct"}', updatedAt: 2 })
    )

    const store = await freshStore()
    const targetKey = StorageKeys.draftPayload(
      'workflows/incoming.json',
      'personal'
    )
    fakeStorage.shouldFailWrite = (key) => key === targetKey

    expect(
      store.saveDraft('workflows/incoming.json', 'x'.repeat(1024), {
        name: 'incoming',
        isTemporary: false
      })
    ).toBe(false)

    expect(store.getDraft(path)?.data).toBe('{"id":"correct"}')
  })

  it('removes a drifted entry together with its stale order key', async () => {
    const driftedPath = 'workflows/drifted.json'
    const canonicalDriftedKey = hashPath(driftedPath)
    const staleKey =
      canonicalDriftedKey === 'deadbeef' ? 'feedface' : 'deadbeef'
    const validPath = 'workflows/valid.json'
    const validKey = hashPath(validPath)
    const indexKey = StorageKeys.draftIndex('personal')
    const payloadPrefix = `${StorageKeys.prefixes.draftPayload}personal:`

    fakeStorage.setItem(
      indexKey,
      JSON.stringify({
        v: 2,
        updatedAt: 1,
        order: [staleKey, validKey],
        entries: {
          [staleKey]: {
            path: driftedPath,
            name: 'drifted',
            isTemporary: false,
            updatedAt: 1
          },
          [validKey]: {
            path: validPath,
            name: 'valid',
            isTemporary: false,
            updatedAt: 2
          }
        }
      })
    )
    fakeStorage.setItem(
      `${payloadPrefix}${staleKey}`,
      JSON.stringify({ data: '{"id":"drifted"}', updatedAt: 1 })
    )
    fakeStorage.setItem(
      `${payloadPrefix}${validKey}`,
      JSON.stringify({ data: '{"id":"valid"}', updatedAt: 2 })
    )

    const store = await freshStore()
    const targetPath = 'workflows/incoming-after-drift.json'
    const targetStorageKey = StorageKeys.draftPayload(targetPath, 'personal')
    let targetWrites = 0
    fakeStorage.shouldFailWrite = (key) => {
      if (key !== targetStorageKey) return false
      targetWrites++
      return targetWrites === 1
    }

    expect(
      store.saveDraft(targetPath, '{"id":"incoming"}', {
        name: 'incoming',
        isTemporary: false
      })
    ).toBe(true)

    const persistedIndex = JSON.parse(fakeStorage.getItem(indexKey)!) as {
      order: string[]
      entries: Record<string, unknown>
    }
    expect(persistedIndex.order).not.toContain(staleKey)
    expect(persistedIndex.entries[staleKey]).toBeUndefined()
    expect(fakeStorage.getItem(`${payloadPrefix}${staleKey}`)).toBeNull()
    expect(store.getDraft(targetPath)?.data).toBe('{"id":"incoming"}')
  })

  it('restores exact previous payload bytes when an index update fails', async () => {
    const path = 'workflows/raw-rollback.json'
    const draftKey = hashPath(path)
    const indexKey = StorageKeys.draftIndex('personal')
    const payloadKey = StorageKeys.draftPayload(path, 'personal')
    const rawPayload = 'malformed-but-previously-stored-payload'

    fakeStorage.setItem(
      indexKey,
      JSON.stringify({
        v: 2,
        updatedAt: 1,
        order: [draftKey],
        entries: {
          [draftKey]: {
            path,
            name: 'raw-rollback',
            isTemporary: false,
            updatedAt: 1
          }
        }
      })
    )
    fakeStorage.setItem(payloadKey, rawPayload)

    const store = await freshStore()
    let failNextIndexWrite = true
    fakeStorage.shouldFailWrite = (key) => {
      if (key !== indexKey || !failNextIndexWrite) return false
      failNextIndexWrite = false
      return true
    }

    expect(
      store.saveDraft(path, '{"new":true}', {
        name: 'raw-rollback',
        isTemporary: false
      })
    ).toBe(false)
    expect(fakeStorage.getItem(payloadKey)).toBe(rawPayload)
  })

  it('drops a recovered cache when the rollback index itself cannot persist', async () => {
    const store = await freshStore()
    const aPath = 'workflows/a.json'
    const bPath = 'workflows/b.json'
    expect(
      store.saveDraft(aPath, '{"id":"a"}', {
        name: 'a',
        isTemporary: false
      })
    ).toBe(true)
    expect(
      store.saveDraft(bPath, '{"id":"b"}', {
        name: 'b',
        isTemporary: false
      })
    ).toBe(true)

    const aKey = hashPath(aPath)
    const bKey = hashPath(bPath)
    const targetPath = 'workflows/rollback-index-failure.json'
    const targetKey = StorageKeys.draftPayload(targetPath, 'personal')
    const targetDraftKey = hashPath(targetPath)
    const indexKey = StorageKeys.draftIndex('personal')
    let targetPayloadRejected = false
    let rejectedRollbackIndex = false

    fakeStorage.shouldFailWrite = (key, value) => {
      if (key === targetKey && !targetPayloadRejected) {
        targetPayloadRejected = true
        return true
      }
      if (key !== indexKey) return false

      const index = JSON.parse(value) as {
        entries: Partial<Record<string, unknown>>
      }
      if (index.entries[targetDraftKey]) return true
      if (
        index.entries[aKey] &&
        index.entries[bKey] &&
        !rejectedRollbackIndex
      ) {
        rejectedRollbackIndex = true
        return true
      }
      return false
    }

    expect(
      store.saveDraft(targetPath, '{"id":"target"}', {
        name: 'target',
        isTemporary: false
      })
    ).toBe(false)
    expect(rejectedRollbackIndex).toBe(true)

    const durableIndex = JSON.parse(fakeStorage.getItem(indexKey)!) as {
      entries: Record<string, unknown>
    }
    expect(durableIndex.entries[aKey]).toBeUndefined()
    expect(durableIndex.entries[bKey]).toBeDefined()

    fakeStorage.shouldFailWrite = () => false
    expect(
      store.saveDraft('workflows/after-rollback.json', '{"id":"after"}', {
        name: 'after',
        isTemporary: false
      })
    ).toBe(true)
    expect(store.getDraft(aPath)).toBeNull()
    expect(store.getDraft(bPath)?.data).toBe('{"id":"b"}')
  })

  it('deletes payloads evicted by the final quota-retry upsert', async () => {
    const paths = Array.from(
      { length: MAX_DRAFTS + 1 },
      (_, index) => `workflows/over-limit-${index}.json`
    )
    const order: string[] = []
    const entries: Record<
      string,
      {
        path: string
        name: string
        isTemporary: boolean
        updatedAt: number
      }
    > = {}
    const indexKey = StorageKeys.draftIndex('personal')

    for (const [index, path] of paths.entries()) {
      const draftKey = hashPath(path)
      order.push(draftKey)
      entries[draftKey] = {
        path,
        name: `over-limit-${index}`,
        isTemporary: false,
        updatedAt: index + 1
      }
      fakeStorage.setItem(
        StorageKeys.draftPayload(path, 'personal'),
        JSON.stringify({ data: `{"id":${index}}`, updatedAt: index + 1 })
      )
    }
    fakeStorage.setItem(
      indexKey,
      JSON.stringify({ v: 2, updatedAt: 1, order, entries })
    )

    const store = await freshStore()
    const targetPath = 'workflows/quota-retry.json'
    const targetPayloadKey = StorageKeys.draftPayload(targetPath, 'personal')
    let targetWrites = 0
    fakeStorage.shouldFailWrite = (key) => {
      if (key !== targetPayloadKey) return false
      targetWrites++
      return targetWrites === 1
    }

    expect(
      store.saveDraft(targetPath, '{"id":"target"}', {
        name: 'target',
        isTemporary: false
      })
    ).toBe(true)

    expect(
      fakeStorage.getItem(StorageKeys.draftPayload(paths[0], 'personal'))
    ).toBeNull()
    expect(
      fakeStorage.getItem(StorageKeys.draftPayload(paths[1], 'personal'))
    ).toBeNull()
    const persistedIndex = JSON.parse(fakeStorage.getItem(indexKey)!) as {
      order: string[]
    }
    expect(persistedIndex.order).toHaveLength(MAX_DRAFTS)
    expect(store.getDraft(targetPath)?.data).toBe('{"id":"target"}')
  })

  it('does not delete an LRU draft before the replacement index commits', async () => {
    const store = await freshStore()
    for (let i = 0; i < MAX_DRAFTS; i++) {
      expect(
        store.saveDraft(`workflows/draft${i}.json`, `{"id":${i}}`, {
          name: `draft${i}`,
          isTemporary: false
        })
      ).toBe(true)
    }

    const indexKey = StorageKeys.draftIndex('personal')
    let failNextIndexWrite = true
    fakeStorage.shouldFailWrite = (key) => {
      if (key !== indexKey || !failNextIndexWrite) return false
      failNextIndexWrite = false
      return true
    }

    expect(
      store.saveDraft('workflows/new.json', '{"id":"new"}', {
        name: 'new',
        isTemporary: false
      })
    ).toBe(false)

    expect(store.getDraft('workflows/draft0.json')?.data).toBe('{"id":0}')
    expect(store.getDraft('workflows/new.json')).toBeNull()
  })
})
