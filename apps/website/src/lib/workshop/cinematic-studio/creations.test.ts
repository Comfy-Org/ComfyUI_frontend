import { Blob } from 'node:buffer'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_DIRECTION } from './catalog'
import type { CreationInput } from './creations'
import {
  CREATION_LIMITS,
  creationNamespace,
  deleteCreation,
  favoriteCreation,
  listCreations,
  renameCreation,
  saveCreation
} from './creations'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('Blob', Blob)
})

function creation(overrides: Partial<CreationInput> = {}): CreationInput {
  return {
    id: 'take-1',
    takeId: 'take-1',
    name: 'Night scene',
    modelSlug: 'image-model',
    prompt: 'A night scene',
    aspect: '16:9',
    createdAt: 100,
    kind: 'image',
    fileName: 'night.png',
    nsfw: false,
    blob: new globalThis.Blob(['pixels'], { type: 'image/png' }),
    ...overrides
  }
}

describe('saved cinematic creations', () => {
  it('persists media and metadata across independent reads and edits', async () => {
    await saveCreation('demo', creation())
    await saveCreation(
      'demo',
      creation({ id: 'take-2', createdAt: 200, kind: 'video' })
    )
    await renameCreation('demo', 'take-1', '  My scene  ')
    await favoriteCreation('demo', 'take-1', true)
    const saved = await listCreations('demo')
    expect(
      saved.map(({ id, name, favorite }) => ({ id, name, favorite }))
    ).toEqual([
      { id: 'take-2', name: 'Night scene', favorite: false },
      { id: 'take-1', name: 'My scene', favorite: true }
    ])
    expect(await saved[1].blob.text()).toBe('pixels')
    await deleteCreation('demo', 'take-1')
    expect((await listCreations('demo')).map(({ id }) => id)).toEqual([
      'take-2'
    ])
  })

  it('isolates same take IDs between accounts, workspaces, and demo', async () => {
    const account = creationNamespace({
      mode: 'live',
      uid: 'alice',
      workspaceId: 'studio'
    })
    const otherAccount = creationNamespace({
      mode: 'live',
      uid: 'bob',
      workspaceId: 'studio'
    })
    const otherWorkspace = creationNamespace({
      mode: 'live',
      uid: 'alice',
      workspaceId: 'other'
    })
    await saveCreation(account, creation())
    await saveCreation(
      creationNamespace({ mode: 'demo' }),
      creation({ name: 'Demo' })
    )
    await deleteCreation(otherAccount, 'take-1')
    expect(await listCreations(otherAccount)).toEqual([])
    expect(await listCreations(otherWorkspace)).toEqual([])
    expect((await listCreations(account))[0].name).toBe('Night scene')
    expect((await listCreations('demo'))[0].name).toBe('Demo')
  })

  it('keeps only approved recipe fields and excludes transient URLs and credentials', async () => {
    const input = {
      ...creation(),
      url: 'https://example.com/signed?secret=value',
      token: 'credential',
      settings: {
        scene: 'night',
        mode: 'image' as const,
        enhance: true,
        direction: DEFAULT_DIRECTION,
        token: 'credential',
        files: ['private.png'],
        video: {
          durationSeconds: 5,
          resolution: '720p' as const,
          generateAudio: false,
          url: 'signed'
        }
      }
    }
    await saveCreation('demo', input)
    const [saved] = await listCreations('demo')
    expect(saved.settings).toEqual({
      scene: 'night',
      mode: 'image',
      enhance: true,
      direction: DEFAULT_DIRECTION,
      video: { durationSeconds: 5, resolution: '720p', generateAudio: false }
    })
    expect(saved).not.toHaveProperty('url')
    expect(saved).not.toHaveProperty('token')
  })

  it('rejects a full library without deleting or overwriting saved work', async () => {
    await Promise.all(
      Array.from({ length: CREATION_LIMITS.count }, (_, index) =>
        saveCreation('demo', creation({ id: String(index) }))
      )
    )
    await expect(saveCreation('demo', creation())).rejects.toMatchObject({
      name: 'QuotaExceededError'
    })
    await saveCreation('demo', creation({ id: '0', name: 'Replacement' }))
    const saved = await listCreations('demo')
    expect(saved).toHaveLength(100)
    expect(saved.find(({ id }) => id === '0')?.name).toBe('Replacement')
  })

  it('surfaces browser quota failure while preserving existing media', async () => {
    await saveCreation('demo', creation())
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError')
    })
    await expect(
      saveCreation('demo', creation({ id: 'take-2' }))
    ).rejects.toMatchObject({ name: 'QuotaExceededError' })
    expect((await listCreations('demo')).map(({ id }) => id)).toEqual([
      'take-1'
    ])
  })

  it('rejects media above the byte budget before writing', async () => {
    vi.spyOn(Blob.prototype, 'size', 'get').mockReturnValue(
      CREATION_LIMITS.bytes + 1
    )
    await expect(saveCreation('demo', creation())).rejects.toMatchObject({
      name: 'QuotaExceededError'
    })
    expect(await listCreations('demo')).toEqual([])
  })

  it('surfaces unavailable browser storage', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(listCreations('demo')).rejects.toThrow()
  })

  it('rejects invalid recipe choices before saving', async () => {
    await expect(
      saveCreation(
        'demo',
        creation({
          settings: {
            mode: 'image',
            scene: 'night',
            enhance: true,
            direction: { ...DEFAULT_DIRECTION, lens: 'https://signed-url' }
          }
        })
      )
    ).rejects.toThrow()
    expect(await listCreations('demo')).toEqual([])
  })
})
