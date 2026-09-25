import { IDBFactory, IDBOpenDBRequest } from 'fake-indexeddb'
import { beforeEach, expect, it, vi } from 'vitest'
import { accessStudioStorage } from './storage'

const config = {
  database: 'studio-storage-test',
  store: 'records',
  label: 'Test',
  namespaceLabel: 'test'
}

beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))

it('rolls back a failed operation even after its result was supplied', async () => {
  const error = new Error('Cannot finish saving')
  await expect(
    accessStudioStorage(config, 'demo', 'readwrite', (store, done, fail) => {
      store.put({ namespace: 'demo', name: 'incomplete' }, 'record')
      done('saved')
      fail(error)
    })
  ).rejects.toBe(error)
  const records = await accessStudioStorage(
    config,
    'demo',
    'readonly',
    (store, done) => {
      const request = store.getAll()
      request.onsuccess = () => done(request.result)
    }
  )
  expect(records).toEqual([])
})

it('rejects a stalled database opening instead of hanging indefinitely', async () => {
  vi.useFakeTimers()
  try {
    vi.spyOn(indexedDB, 'open').mockReturnValue(new IDBOpenDBRequest())
    const pending = accessStudioStorage(config, 'demo', 'readonly', () => {
      throw new Error('A stalled database must not run the operation')
    })
    await Promise.all([
      expect(pending).rejects.toMatchObject({ name: 'TimeoutError' }),
      vi.advanceTimersByTimeAsync(10000)
    ])
  } finally {
    vi.useRealTimers()
  }
})
