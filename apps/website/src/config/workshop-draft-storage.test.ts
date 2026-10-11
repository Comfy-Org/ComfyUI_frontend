import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { storeWorkshopDraft, readWorkshopDraft } from './workshop-draft-storage'

const files = { image: 'https://example.com/reference.webp' }
const signal = () => new AbortController().signal

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
})

describe('workshop draft storage', () => {
  it('keeps a draft available while the caller validates it', async () => {
    await storeWorkshopDraft('draft', files, signal())
    expect(await readWorkshopDraft('draft', signal())).toEqual(files)
    expect(await readWorkshopDraft('draft', signal())).toEqual(files)
  })

  it('commits expired-draft cleanup before a quota-limited write', async () => {
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    await storeWorkshopDraft('expired', files, signal())
    clock.mockReturnValue(now + 60 * 60 * 1000 + 1)
    const remove = IDBObjectStore.prototype.delete
    const put = IDBObjectStore.prototype.put
    let cleanupCommitted = false
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(
      function (this: IDBObjectStore, key) {
        this.transaction.addEventListener('complete', () => {
          cleanupCommitted = true
        })
        return remove.call(this, key)
      }
    )
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(
      function (this: IDBObjectStore, value, key) {
        if (!cleanupCommitted)
          throw new DOMException('Origin quota exhausted', 'QuotaExceededError')
        return put.call(this, value, key)
      }
    )

    await expect(
      storeWorkshopDraft('fresh', files, signal())
    ).resolves.toBeUndefined()
    expect(await readWorkshopDraft('fresh', signal())).toEqual(files)
    expect(await readWorkshopDraft('expired', signal())).toBeUndefined()
  })

  it('keeps at most four drafts after concurrent saves', async () => {
    const keys = Array.from({ length: 8 }, (_, index) => `draft-${index}`)
    await Promise.all(
      keys.map((key) => storeWorkshopDraft(key, files, signal()))
    )
    const drafts = await Promise.all(
      keys.map((key) => readWorkshopDraft(key, signal()))
    )
    expect(drafts.filter((draft) => draft !== undefined)).toHaveLength(4)
  })

  it('rejects an already cancelled save without opening storage', async () => {
    const controller = new AbortController()
    controller.abort()
    const open = vi.spyOn(indexedDB, 'open')
    await expect(
      storeWorkshopDraft('draft', files, controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(open).not.toHaveBeenCalled()
  })

  it('reports unavailable storage', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('Storage disabled', 'SecurityError')
    })
    await expect(
      storeWorkshopDraft('draft', files, signal())
    ).rejects.toMatchObject({ name: 'SecurityError' })
  })
})
