import { Blob } from 'node:buffer'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { creationNamespace, listCreations } from './creations'
import {
  deleteModelResult,
  listModelResults,
  MODEL_RESULT_LIMITS,
  saveModelResult
} from './model-results'
import type { ModelResultInput } from './model-results'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('Blob', Blob)
})
const input = (
  overrides: Partial<ModelResultInput> = {}
): ModelResultInput => ({
  id: 'result-1',
  name: 'My result',
  modelSlug: 'model--generate',
  createdAt: 1,
  outputs: [
    {
      kind: 'image',
      fileName: 'frame.png',
      blob: new globalThis.Blob(['pixels'], { type: 'image/png' })
    }
  ],
  ...overrides
})

describe('saved native model results', () => {
  it('round trips every output modality, flags and bytes, newest first', async () => {
    const kinds = ['image', 'video', 'audio', '3d', 'text', 'other'] as const
    const outputs = kinds.map((kind) => ({
      ...input().outputs[0],
      kind,
      nsfw: true
    }))
    await saveModelResult('demo', input({ outputs }))
    await saveModelResult('demo', input({ id: 'newer', createdAt: 2 }))
    const saved = await listModelResults('demo')
    expect(saved.map((record) => record.id)).toEqual(['newer', 'result-1'])
    expect(saved[0].outputs[0].nsfw).toBe(false)
    expect(saved[1].outputs.map((output) => output.kind)).toEqual([
      'image',
      'video',
      'audio',
      '3d',
      'text',
      'other'
    ])
    expect(saved[1].outputs.every((output) => output.nsfw)).toBe(true)
    expect(await saved[1].outputs[0].blob.text()).toBe('pixels')
    expect(await listCreations('demo')).toEqual([])
  })

  it('isolates account, workspace and demo records and scopes deletion', async () => {
    const alice = creationNamespace({
      mode: 'live',
      uid: 'alice',
      workspaceId: 'one'
    })
    const bob = creationNamespace({
      mode: 'live',
      uid: 'bob',
      workspaceId: 'one'
    })
    const other = creationNamespace({
      mode: 'live',
      uid: 'alice',
      workspaceId: 'two'
    })
    for (const scope of [alice, bob, other, 'demo'])
      await saveModelResult(scope, input({ name: scope }))
    await deleteModelResult(alice, 'result-1')
    expect(await listModelResults(alice)).toEqual([])
    for (const scope of [bob, other, 'demo'])
      expect((await listModelResults(scope))[0].name).toBe(scope)
    await expect(listModelResults('')).rejects.toThrow()
  })

  it('upserts identical IDs at the count limit without evicting other results', async () => {
    await Promise.all(
      Array.from({ length: MODEL_RESULT_LIMITS.count }, (_, index) =>
        saveModelResult('demo', input({ id: String(index) }))
      )
    )
    await expect(saveModelResult('demo', input())).rejects.toMatchObject({
      name: 'QuotaExceededError'
    })
    await saveModelResult('demo', input({ id: '0', name: 'Updated' }))
    const saved = await listModelResults('demo')
    expect(saved).toHaveLength(100)
    expect(saved.find((record) => record.id === '0')?.name).toBe('Updated')
  })

  it('counts all output blobs against the byte budget and preserves prior data on browser quota failure', async () => {
    await saveModelResult('demo', input())
    const size = vi
      .spyOn(Blob.prototype, 'size', 'get')
      .mockReturnValue(MODEL_RESULT_LIMITS.bytes / 2 + 1)
    await expect(
      saveModelResult(
        'demo',
        input({
          id: 'large',
          outputs: [...input().outputs, ...input().outputs]
        })
      )
    ).rejects.toMatchObject({ name: 'QuotaExceededError' })
    size.mockRestore()
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    await expect(
      saveModelResult('demo', input({ id: 'second' }))
    ).rejects.toMatchObject({ name: 'QuotaExceededError' })
    expect((await listModelResults('demo')).map((record) => record.id)).toEqual(
      ['result-1']
    )
  })

  it('rejects response metadata, private fields and malformed media before persisting', async () => {
    const metadata = {
      ...input(),
      outputs: [{ ...input().outputs[0], purpose: 'response-metadata' }]
    }
    await expect(saveModelResult('demo', metadata)).rejects.toThrow()
    const privateInput = {
      ...input(),
      url: 'https://signed/private',
      token: 'secret',
      form: { prompt: 'private' },
      rawResponse: {}
    }
    await expect(saveModelResult('demo', privateInput)).rejects.toThrow()
    await expect(
      saveModelResult('demo', input({ outputs: [] }))
    ).rejects.toThrow()
    await expect(
      saveModelResult(
        'demo',
        input({
          outputs: [{ ...input().outputs[0], blob: new globalThis.Blob([]) }]
        })
      )
    ).rejects.toThrow()
    expect(await listModelResults('demo')).toEqual([])
  })

  it('surfaces corrupt stored records instead of returning unvalidated data or bypassing limits', async () => {
    await saveModelResult('demo', input())
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open('comfy-cinema-model-results', 1)
      opening.onerror = () => reject(opening.error)
      opening.onsuccess = () => {
        const database = opening.result
        const transaction = database.transaction('results', 'readwrite')
        transaction
          .objectStore('results')
          .put({ namespace: 'demo', id: 'corrupt', outputs: 'unsafe' }, [
            'demo',
            'corrupt'
          ])
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error)
        }
      }
    })
    await expect(listModelResults('demo')).rejects.toThrow()
    await expect(
      saveModelResult('demo', input({ id: 'next' }))
    ).rejects.toThrow()
    await deleteModelResult('demo', 'corrupt')
    expect((await listModelResults('demo')).map((record) => record.id)).toEqual(
      ['result-1']
    )
    vi.stubGlobal('indexedDB', undefined)
    await expect(listModelResults('demo')).rejects.toThrow()
  })
})
