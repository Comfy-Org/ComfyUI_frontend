import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { UserFile } from '@/stores/userFileStore'
import {
  SavedFileIdentityError,
  SavedFilePathUnavailableError
} from '@/platform/workflow/core/utils/userFileIdentity'
import { registerUserFileScopeProvider } from '@/platform/workflow/core/services/userFileContext'

const identity = {
  id: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
  ownerId: 'user-1',
  workspaceId: 'workspace-1'
}
const path = 'workflows/private.json'
const encodedPath = encodeURIComponent(path)

describe('identity-conditional userdata operations', () => {
  beforeEach(() => registerUserFileScopeProvider(() => identity))

  it('binds actual path reads to the expected UUID', async () => {
    const request = vi
      .spyOn(api, 'fetchApi')
      .mockResolvedValue(new Response('saved'))
    const file = new UserFile(path, 1, 5, identity)
    await file.load()
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/userdata-files/${identity.id}/path/${encodedPath}`,
      {}
    )
    expect(file.originalContent).toBe('saved')
  })

  it.for(['read', 'save', 'delete', 'rename'] as const)(
    'refuses a replacement during %s without losing local state or retrying unguarded',
    async (operation) => {
      const request = vi
        .spyOn(api, 'fetchApi')
        .mockResolvedValue(new Response(null, { status: 412 }))
      const file = new UserFile(path, 1, 5, identity)
      file.content = 'local edits'
      file.originalContent = 'saved'
      const perform = {
        read: () => file.load({ force: true }),
        save: () => file.save({ force: true }),
        delete: () => file.delete(),
        rename: () => file.rename('workflows/new.json')
      }
      await expect(perform[operation]()).rejects.toThrow('412')
      expect(request).toHaveBeenCalledOnce()
      const url = request.mock.calls[0][0]
      expect(new URL(url, 'https://example.test').pathname).toContain(
        `/userdata-files/${identity.id}/path/`
      )
      expect(file.path).toBe(path)
      expect(file.originalContent).toBe('saved')
      expect(file.content).toBe('local edits')
      expect(file.savedFileIdentity).toEqual(identity)
    }
  )

  it.for([404, 412, 409, 500])(
    'a guarded failed read preserves identity/content and clears loading for HTTP%s',
    async (status) => {
      vi.spyOn(api, 'fetchApi').mockResolvedValue(
        new Response(null, { status })
      )
      const file = new UserFile(path, 1, 5, identity)
      file.content = 'local edits'
      file.originalContent = 'saved'
      let failure: unknown
      try {
        await file.load({ force: true })
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(DOMException)
      expect(failure).toMatchObject({
        message: expect.stringContaining(String(status))
      })
      expect(failure instanceof SavedFilePathUnavailableError).toBe(
        status === 404 || status === 412
      )
      expect(file.isLoading).toBe(false)
      expect(file.content).toBe('local edits')
      expect(file.originalContent).toBe('saved')
      expect(file.savedFileIdentity).toEqual(identity)
    }
  )

  it('a scope revoked while a read awaits still clears loading and retains local content', async () => {
    vi.spyOn(api, 'fetchApi').mockImplementation(async () => {
      registerUserFileScopeProvider(() => ({
        ownerId: 'owner-b',
        workspaceId: identity.workspaceId
      }))
      return new Response('other owner response')
    })
    const file = new UserFile(path, 1, 5, identity)
    file.content = 'local edits'
    file.originalContent = 'saved'
    await expect(file.load({ force: true })).rejects.toBeInstanceOf(
      SavedFileIdentityError
    )
    expect(file.isLoading).toBe(false)
    expect(file.content).toBe('local edits')
    expect(file.originalContent).toBe('saved')
  })

  it('an unbound missing read remains an ordinary error rather than an identity refusal', async () => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(
      new Response(null, { status: 404 })
    )
    const file = new UserFile(path, 1, 5)
    let failure: unknown
    try {
      await file.load()
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(DOMException)
    expect(failure).not.toBeInstanceOf(SavedFilePathUnavailableError)
    expect(file.isLoading).toBe(false)
  })

  it('a read body failure clears loading while retaining local edits and saved baseline', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.error(new Error('unreadable response body'))
      }
    })
    vi.spyOn(api, 'fetchApi').mockResolvedValue(new Response(body))
    const file = new UserFile(path, 1, 5, identity)
    file.content = 'local edits'
    file.originalContent = 'saved'
    await expect(file.load({ force: true })).rejects.toThrow(
      'unreadable response body'
    )
    expect(file.isLoading).toBe(false)
    expect(file.content).toBe('local edits')
    expect(file.originalContent).toBe('saved')
  })

  it('retains UUID after save and rename and sends the guard on each mutation', async () => {
    const request = vi
      .spyOn(api, 'fetchApi')
      .mockImplementation(async (_url, options) =>
        options?.method === 'DELETE'
          ? new Response(null, { status: 204 })
          : Response.json({ id: identity.id, modified: 2, size: 10 })
      )
    const file = new UserFile(path, 1, 5, identity)
    file.content = 'new saved'
    await file.save()
    await file.rename('workflows/renamed.json')
    await file.delete()
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      `/userdata-files/${identity.id}/path/${encodedPath}?overwrite=true&full_info=true`,
      `/userdata-files/${identity.id}/path/${encodedPath}/move/workflows%2Frenamed.json?overwrite=false`,
      `/userdata-files/${identity.id}/path/workflows%2Frenamed.json`
    ])
    expect(file.savedFileIdentity).toEqual(identity)
  })

  it('Save As receives a new identity without conditioning creation on the source UUID', async () => {
    const newId = '78ebcb5b-028d-45e8-9f9c-b20f433c364d'
    const request = vi
      .spyOn(api, 'fetchApi')
      .mockResolvedValue(Response.json({ id: newId, modified: 2, size: 10 }))
    const source = new UserFile(path, 1, 5, identity)
    source.content = source.originalContent = 'saved'
    const copy = await source.saveAs('workflows/copy.json')
    expect(copy.savedFileIdentity).toEqual({ ...identity, id: newId })
    expect(source.savedFileIdentity).toEqual(identity)
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      '/userdata/workflows%2Fcopy.json?overwrite=false&full_info=true'
    ])
  })
  it.for(['read', 'save', 'delete', 'rename'] as const)(
    'refuses an older server lacking bound routes during %s without fallback',
    async (operation) => {
      const request = vi
        .spyOn(api, 'fetchApi')
        .mockImplementation(async (url) =>
          url.startsWith('/userdata-files/')
            ? new Response(null, { status: 404 })
            : Response.json({ id: 'replacement' })
        )
      const file = new UserFile(path, 1, 5, identity)
      file.content = 'local edits'
      file.originalContent = 'saved'
      const perform = {
        read: () => file.load({ force: true }),
        save: () => file.save({ force: true }),
        delete: () => file.delete(),
        rename: () => file.rename('workflows/new.json')
      }
      await expect(perform[operation]()).rejects.toThrow('404')
      expect(request).toHaveBeenCalledOnce()
      expect(request.mock.calls[0][0]).toContain(
        `/userdata-files/${identity.id}/path/`
      )
      expect(file.path).toBe(path)
      expect(file.originalContent).toBe('saved')
      expect(file.content).toBe('local edits')
    }
  )
  it('does not certify a new save response under a changed scope after an authorized request was sent', async () => {
    let scope = { ownerId: identity.ownerId, workspaceId: identity.workspaceId }
    registerUserFileScopeProvider(() => scope)
    const request = vi.spyOn(api, 'fetchApi').mockImplementation(async () => {
      scope = { ownerId: 'new-owner', workspaceId: 'new-workspace' }
      return Response.json({
        id: '78ebcb5b-028d-45e8-9f9c-b20f433c364d',
        modified: 2,
        size: 10
      })
    })
    const file = UserFile.createTemporary('workflows/copy.json')
    file.content = 'saved in original scope'
    await expect(file.save()).rejects.toThrow('another authenticated scope')
    expect(request).toHaveBeenCalledOnce()
    expect(file.savedFileIdentity).toBeUndefined()
    expect(file.isTemporary).toBe(true)
    expect(file.originalContent).toBeNull()
  })
})
