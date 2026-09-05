/**
 * Storage reaches the real user-data routes, and refuses names that are not
 * the pack's to write.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { ComfyApiError } from './errors'
import { createStorageApi } from './storageHandle'
import type { StorageHandle } from './storageHandle'

describe('pack storage', () => {
  let storage: StorageHandle

  beforeEach(() => {
    storage = createStorageApi()
  })

  it('lists what the pack has stored', async () => {
    // The endpoint answers with paths relative to the directory asked for,
    // which is what `syncUtil` and the keybinding presets both re-prefix.
    vi.spyOn(api, 'listUserDataFullInfo').mockResolvedValue([
      { path: 'one', size: 1, modified: 0 },
      { path: 'two', size: 1, modified: 0 }
    ])

    // Namespaced, so a listed path can be handed straight back to `get`.
    await expect(storage.list('KJNodes.ideogram')).resolves.toEqual([
      'KJNodes.ideogram/one',
      'KJNodes.ideogram/two'
    ])
  })

  it('reads stored text back', async () => {
    vi.spyOn(api, 'getUserData').mockResolvedValue(
      new Response('a caption', { status: 200 })
    )

    await expect(storage.get('KJNodes.ideogram/one')).resolves.toBe('a caption')
  })

  it('treats nothing stored as undefined, not an error', async () => {
    vi.spyOn(api, 'getUserData').mockResolvedValue(
      new Response('', { status: 404 })
    )

    await expect(storage.get('KJNodes.ideogram/gone')).resolves.toBeUndefined()
  })

  it('reports a real read failure rather than returning undefined', async () => {
    vi.spyOn(api, 'getUserData').mockResolvedValue(
      new Response('', { status: 500, statusText: 'Server Error' })
    )

    await expect(storage.get('KJNodes.ideogram/x')).rejects.toThrow(
      ComfyApiError
    )
  })

  it('stores the text as written, without JSON-encoding it', async () => {
    const store = vi
      .spyOn(api, 'storeUserData')
      .mockResolvedValue(new Response('', { status: 200 }))

    await storage.set('KJNodes.ideogram/one', 'a "quoted" caption')

    expect(store).toHaveBeenCalledWith(
      'KJNodes.ideogram/one',
      'a "quoted" caption',
      expect.objectContaining({ stringify: false, overwrite: true })
    )
  })

  it('removes the namespaced document', async () => {
    const remove = vi
      .spyOn(api, 'deleteUserData')
      .mockResolvedValue(new Response('', { status: 200 }))

    await storage.remove('KJNodes.ideogram/one')

    expect(remove).toHaveBeenCalledWith('KJNodes.ideogram/one')
  })

  it('reports a failed removal', async () => {
    vi.spyOn(api, 'deleteUserData').mockResolvedValue(
      new Response('', { status: 500, statusText: 'Server Error' })
    )

    await expect(storage.remove('KJNodes.ideogram/one')).rejects.toThrow(
      ComfyApiError
    )
  })

  it('refuses a name that is not namespaced', async () => {
    // One flat space, shared with core and every other pack.
    await expect(storage.get('templates/one')).rejects.toThrow(ComfyApiError)
    await expect(storage.set('one', 'x')).rejects.toThrow(ComfyApiError)
  })

  it('refuses a name that climbs out of its namespace', async () => {
    await expect(storage.get('KJNodes.ideogram/../../secrets')).rejects.toThrow(
      /must not contain/
    )
  })
})
