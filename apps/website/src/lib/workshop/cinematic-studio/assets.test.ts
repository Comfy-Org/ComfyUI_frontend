import { Blob, File } from 'node:buffer'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SavedAsset } from './assets'
import {
  ASSET_LIMITS,
  assetFile,
  cropBounds,
  deleteAsset,
  listAssets,
  saveAsset,
  validateAsset
} from './assets'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('Blob', Blob)
  vi.stubGlobal('File', File)
})
function asset(overrides: Partial<SavedAsset> = {}): SavedAsset {
  return {
    id: 'reference-1',
    name: 'Mara',
    kind: 'character',
    notes: 'Red raincoat',
    blob: new globalThis.Blob(['pixels'], { type: 'image/png' }),
    ...overrides
  }
}

describe('named reference assets', () => {
  it('persists images and editable metadata without mutating the source', async () => {
    const original = asset()
    await saveAsset('alice/workspace', original)
    await saveAsset('alice/workspace', {
      ...original,
      name: '  Mara portrait  ',
      notes: 'Short dark hair',
      kind: 'character'
    })
    const saved = await listAssets('alice/workspace')
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({
      name: 'Mara portrait',
      notes: 'Short dark hair'
    })
    expect(await saved[0].blob.text()).toBe('pixels')
    expect(original.name).toBe('Mara')
    const file = assetFile(saved[0])
    expect(file.name).toBe('Mara portrait.png')
    expect(await file.text()).toBe('pixels')
  })

  it('isolates reads, updates and deletes by account/workspace namespace', async () => {
    await saveAsset('alice/main', asset())
    await saveAsset(
      'bob/main',
      asset({ name: 'Bob location', kind: 'location' })
    )
    await deleteAsset('alice/other', 'reference-1')
    expect(await listAssets('alice/other')).toEqual([])
    expect((await listAssets('alice/main'))[0].name).toBe('Mara')
    await deleteAsset('bob/main', 'reference-1')
    expect(await listAssets('bob/main')).toEqual([])
    expect(await listAssets('alice/main')).toHaveLength(1)
    await expect(listAssets('')).rejects.toThrow('namespace')
  })

  it('rejects invalid files and metadata before writing and drops unrelated fields', async () => {
    for (const input of [
      asset({ name: ' ' }),
      asset({ notes: 'x'.repeat(501) }),
      asset({ blob: new globalThis.Blob(['video'], { type: 'video/mp4' }) }),
      asset({ blob: new globalThis.Blob([], { type: 'image/png' }) }),
      asset({
        blob: new globalThis.Blob(
          [new Uint8Array(ASSET_LIMITS.fileBytes + 1)],
          { type: 'image/png' }
        )
      })
    ]) {
      await expect(saveAsset('demo', input)).rejects.toThrow()
    }
    expect(await listAssets('demo')).toEqual([])
    expect(
      validateAsset({
        ...asset(),
        sourceUrl: 'https://example.com/private',
        token: 'unused'
      })
    ).not.toHaveProperty('sourceUrl')
    expect(validateAsset({ ...asset(), token: 'unused' })).not.toHaveProperty(
      'token'
    )
  })

  it('enforces count quota atomically and allows updating at the limit', async () => {
    await Promise.all(
      Array.from({ length: ASSET_LIMITS.count }, (_, index) =>
        saveAsset('demo', asset({ id: `asset-${index}` }))
      )
    )
    await expect(
      saveAsset('demo', asset({ id: 'overflow' }))
    ).rejects.toMatchObject({ name: 'QuotaExceededError' })
    await saveAsset('demo', asset({ id: 'asset-0', name: 'Updated' }))
    expect(await listAssets('demo')).toHaveLength(ASSET_LIMITS.count)
    await deleteAsset('demo', 'asset-1')
    await saveAsset('demo', asset({ id: 'replacement' }))
    expect(await listAssets('demo')).toHaveLength(ASSET_LIMITS.count)
  })

  it('enforces the aggregate byte quota without removing earlier references', async () => {
    const blob = new globalThis.Blob([new Uint8Array(ASSET_LIMITS.fileBytes)], {
      type: 'image/png'
    })
    const count = Math.floor(ASSET_LIMITS.bytes / blob.size)
    for (let index = 0; index < count; index++)
      await saveAsset('demo', asset({ id: `asset-${index}`, blob }))
    await expect(
      saveAsset('demo', asset({ id: 'overflow', blob }))
    ).rejects.toMatchObject({ name: 'QuotaExceededError' })
    expect(await listAssets('demo')).toHaveLength(count)
  })
})

describe('source-pixel reference cropping', () => {
  it.for([
    {
      input: { x: 10.3, y: 20.8, width: 99.4, height: 101.8 },
      expected: { x: 10, y: 21, width: 99, height: 102 }
    },
    {
      input: { x: -10, y: 900, width: 900, height: 0 },
      expected: { x: 0, y: 479, width: 640, height: 1 }
    }
  ])('bounds a crop to integer source pixels', ({ input, expected }) => {
    expect(cropBounds(input, 640, 480)).toEqual(expected)
  })
  it('rejects invalid geometry and oversized decoded images', () => {
    expect(() =>
      cropBounds({ x: NaN, y: 0, width: 10, height: 10 }, 640, 480)
    ).toThrow('crop')
    expect(() =>
      cropBounds({ x: 0, y: 0, width: 10, height: 10 }, 0, 480)
    ).toThrow('dimensions')
    expect(() =>
      cropBounds({ x: 0, y: 0, width: 10, height: 10 }, 10000, 10000)
    ).toThrow('dimensions')
  })
})
