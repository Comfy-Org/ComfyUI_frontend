/**
 * Regression: a transient localStorage quota failure must not permanently
 * disable draft persistence for the rest of the page's life.
 *
 * `storageIO.ts` used to keep a module-level `storageAvailable` flag that
 * `workflowDraftStoreV2.handleQuotaExceeded()` flipped to `false` and nothing
 * ever flipped back. Once storage pressure is relieved (or the user simply
 * switches to a different, small workflow) drafts should be persisted again.
 */
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

/**
 * Minimal Storage stand-in whose writes can be made to fail on demand.
 * happy-dom's own `localStorage` is a Proxy, so its methods cannot be
 * monkey-patched; we swap the whole global instead.
 */
class FakeStorage implements Storage {
  readonly map = new Map<string, string>()
  quotaExhausted = false

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
    if (this.quotaExhausted) {
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

/**
 * Fresh module registry per test so no module-level state in storageIO
 * leaks between cases.
 */
async function freshStore() {
  vi.resetModules()
  const { useWorkflowDraftStoreV2 } = await import('./workflowDraftStoreV2')
  return useWorkflowDraftStoreV2()
}

describe('workflowDraftStoreV2 quota recovery', () => {
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

  it('persists a later draft once storage pressure is relieved', async () => {
    const store = await freshStore()

    // A draft already exists, so the quota handler has something to evict.
    expect(
      store.saveDraft('workflows/big.json', '{"nodes":["big"]}', {
        name: 'big',
        isTemporary: false
      })
    ).toBe(true)

    // Storage is momentarily full: every write throws QuotaExceededError.
    fakeStorage.quotaExhausted = true

    expect(
      store.saveDraft('workflows/huge.json', 'x'.repeat(64), {
        name: 'huge',
        isTemporary: false
      })
    ).toBe(false)

    // Pressure relieved — the user closed the huge workflow, the browser
    // freed space, whatever. Writes work again.
    fakeStorage.quotaExhausted = false
    fakeStorage.clear()

    const saved = store.saveDraft('workflows/small.json', '{"nodes":[]}', {
      name: 'small',
      isTemporary: true
    })

    expect(saved).toBe(true)

    // Observable outcome: the draft is actually retrievable and on disk.
    const draft = store.getDraft('workflows/small.json')
    expect(draft).not.toBeNull()
    expect(draft!.data).toBe('{"nodes":[]}')

    const payloadKeys = [...fakeStorage.map.keys()].filter((k) =>
      k.startsWith('Comfy.Workflow.Draft.v2:')
    )
    expect(payloadKeys).toHaveLength(1)
  })
})
