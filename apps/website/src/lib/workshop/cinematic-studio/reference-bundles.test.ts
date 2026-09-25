import { Blob, File } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadReferenceBundle, saveReferenceBundle } from './reference-bundles'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('Blob', Blob)
  vi.stubGlobal('File', File)
  vi.stubGlobal('crypto', webcrypto)
})
describe('saved reference bundles', () => {
  it('restores both boundary bytes and roles across independent reads, scoped to the workspace', async () => {
    const first = new globalThis.File(['first pixels'], 'first.png', {
      type: 'image/png'
    })
    const last = new globalThis.File(['last pixels'], 'last.png', {
      type: 'image/png'
    })
    const id = await saveReferenceBundle('alice', [
      { role: 'first', file: first },
      { role: 'last', file: last }
    ])
    expect(id).toBeDefined()
    const restored = await loadReferenceBundle('alice', id!)
    expect(
      await Promise.all(
        restored.map(async ({ role, file }) => [
          role,
          file.name,
          await file.text()
        ])
      )
    ).toEqual([
      ['first', 'first.png', 'first pixels'],
      ['last', 'last.png', 'last pixels']
    ])
    await expect(loadReferenceBundle('bob', id!)).rejects.toThrow()
    expect(
      await saveReferenceBundle('alice', [
        { role: 'first', file: first },
        { role: 'last', file: last }
      ])
    ).toBe(id)
    expect(
      await saveReferenceBundle('alice', [
        { role: 'first', file: last },
        { role: 'last', file: first }
      ])
    ).not.toBe(id)
  })
  it('rejects unsupported media and does not create a fake empty bundle', async () => {
    expect(await saveReferenceBundle('alice', [])).toBeUndefined()
    await expect(
      saveReferenceBundle('alice', [
        {
          role: 'cast',
          file: new globalThis.File(['x'], 'bad.txt', { type: 'text/plain' })
        }
      ])
    ).rejects.toThrow()
  })
})
