import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { reactive } from 'vue'

import { useCustomNodePacks } from './useCustomNodePacks'

const mocks = vi.hoisted(() => ({
  reloadNodeDefs: vi.fn(),
  auth: { userId: 'account-a' as string | undefined },
  apiAuth: { currentUser: null as { id: string } | null },
  workspace: {
    activeWorkspaceId: 'workspace-a',
    workspaceTransitionGeneration: 0
  }
}))
vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => mocks.apiAuth
}))
vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => mocks.workspace
}))

vi.mock('@/scripts/api', () => ({
  api: { fetchApi: vi.fn() }
}))
vi.mock('@/scripts/app', () => ({
  app: { reloadNodeDefs: mocks.reloadNodeDefs }
}))

const fetchApi = vi.mocked(api.fetchApi)

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: () => Promise.resolve(body)
  }) as unknown as Response

describe('useCustomNodePacks', () => {
  beforeEach(() => {
    fetchApi.mockReset()
    mocks.reloadNodeDefs.mockReset()
    mocks.auth = reactive({ userId: 'account-a' })
    mocks.apiAuth = reactive({ currentUser: null })
    mocks.workspace = reactive({
      activeWorkspaceId: 'workspace-a',
      workspaceTransitionGeneration: 0
    })
  })

  it('hides cached private packs immediately on account change and ignores a late response', async () => {
    const row = {
      revision_id: 'my-pack-x12345678',
      name: 'Private A',
      owner: 'account:a',
      snapshot: '',
      uploaded_at: ''
    }
    fetchApi.mockResolvedValueOnce(jsonResponse([row]))
    const store = useCustomNodePacks()
    await store.refresh()
    expect(store.packs.value[0]?.name).toBe('Private A')
    let finish: (response: Response) => void = () => undefined
    fetchApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const pending = store.refresh()
    mocks.auth.userId = 'account-b'
    expect(store.packs.value).toEqual([])
    finish(jsonResponse([row]))
    await pending
    expect(store.packs.value).toEqual([])
    fetchApi.mockResolvedValueOnce(jsonResponse([]))
    await store.refresh()
    expect(store.packs.value).toEqual([])
  })

  it('uses the validated API account and retains runtime revision metadata', async () => {
    mocks.auth.userId = undefined
    mocks.apiAuth.currentUser = { id: 'api-user-a' }
    const id = 'a'.repeat(64)
    fetchApi.mockResolvedValueOnce(
      jsonResponse([
        {
          revision_id: 'mine-x12345678',
          name: 'Mine',
          owner: 'account:api-user-a',
          snapshot: '',
          uploaded_at: '',
          runtime_revision_id: id,
          node_types: { Echo: 'User_' + 'b'.repeat(24) + '_Echo' }
        }
      ])
    )
    const store = useCustomNodePacks()
    await store.refresh()
    expect(store.packs.value[0]?.runtimeRevisionId).toBe(id)
    mocks.apiAuth.currentUser = null
    expect(store.packs.value).toEqual([])
    fetchApi.mockClear()
    await store.refresh()
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('accepts an archive-only publication without a legacy snapshot path', async () => {
    const id = 'c'.repeat(64)
    const publicId = 'User_' + 'd'.repeat(24) + '_Echo'
    fetchApi.mockResolvedValueOnce(
      jsonResponse([
        {
          revision_id: 'mine-x12345678',
          name: 'Mine',
          owner: 'account:a',
          archive: '/private/runtime/mine.zip',
          uploaded_at: '2026-10-08T08:59:07Z',
          runtime_revision_id: id,
          node_types: { Echo: publicId }
        }
      ])
    )
    const store = useCustomNodePacks()
    await store.refresh()
    expect(store.packs.value).toEqual([
      {
        revisionId: 'mine-x12345678',
        name: 'Mine',
        uploadedAt: '2026-10-08T08:59:07Z',
        runtimeRevisionId: id,
        nodeTypes: { Echo: publicId }
      }
    ])
  })

  it('posts a pack as multipart without an owner and derives the name from the file', async () => {
    fetchApi
      .mockResolvedValueOnce(jsonResponse({ status: 'accepted' })) // POST
      .mockResolvedValueOnce(jsonResponse([])) // refresh GET

    const { uploadPack } = useCustomNodePacks()
    await uploadPack(new File([new Uint8Array([1, 2, 3])], 'My Pack.zip'))

    const [route, options] = fetchApi.mock.calls[0]
    expect(route).toBe('/customnodes')
    expect(options?.method).toBe('POST')
    const form = options?.body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('name')).toBe('My Pack')
    expect(form.get('idempotency_key')).toBeTruthy()
    expect(form.get('file')).toBeInstanceOf(File)
    // The owner is the authenticated session, never client input.
    expect(form.get('owner')).toBeNull()
  })

  it('refreshes the owner listing after a successful upload', async () => {
    fetchApi
      .mockResolvedValueOnce(jsonResponse({ status: 'accepted' }))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            revision_id: 'my-pack-x1234567',
            name: 'My Pack',
            owner: 'ws-1',
            snapshot: '/uploads/my-pack/x1234567',
            uploaded_at: '2026-08-28T12:00:00Z'
          }
        ])
      )

    const { uploadPack, packs } = useCustomNodePacks()
    await uploadPack(new File(['x'], 'My Pack.zip'))

    expect(fetchApi.mock.calls[1]).toEqual(['/customnodes', { method: 'GET' }])
    expect(mocks.reloadNodeDefs).toHaveBeenCalledOnce()
    expect(packs.value).toEqual([
      {
        revisionId: 'my-pack-x1234567',
        name: 'My Pack',
        uploadedAt: '2026-08-28T12:00:00Z'
      }
    ])
  })

  it('deletes a pack by name and refreshes the listing', async () => {
    fetchApi
      .mockResolvedValueOnce(jsonResponse({ status: 'deleted' })) // DELETE
      .mockResolvedValueOnce(jsonResponse([])) // refresh GET

    const { deletePack } = useCustomNodePacks()
    await deletePack('My Pack')

    expect(fetchApi.mock.calls[0]).toEqual([
      '/customnodes?name=My%20Pack',
      { method: 'DELETE' }
    ])
    expect(fetchApi.mock.calls[1]).toEqual(['/customnodes', { method: 'GET' }])
    expect(mocks.reloadNodeDefs).toHaveBeenCalledOnce()
  })

  it('throws the server error message when an upload is rejected', async () => {
    fetchApi.mockResolvedValueOnce(
      jsonResponse({ error: 'pack folder has an unusable name' }, false, 400)
    )

    const { uploadPack } = useCustomNodePacks()
    await expect(uploadPack(new File(['x'], 'bad.zip'))).rejects.toThrow(
      'pack folder has an unusable name'
    )
  })

  it('downloads the selected revision with a pack filename', async () => {
    const archive = new Blob(['zip-bytes'], { type: 'application/zip' })
    fetchApi.mockResolvedValueOnce(new Response(archive, { status: 200 }))
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:custom-node')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL')
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const remove = vi
      .spyOn(HTMLAnchorElement.prototype, 'remove')
      .mockImplementation(() => undefined)

    const { downloadPack, downloadingRevisionId } = useCustomNodePacks()
    await downloadPack({
      revisionId: 'echo-pack-x12345678',
      name: 'Echo Pack',
      uploadedAt: '2026-08-28T12:00:00Z'
    })

    expect(fetchApi).toHaveBeenCalledWith(
      '/customnodes/echo-pack-x12345678/download',
      { method: 'GET' }
    )
    const link = document.body.querySelector<HTMLAnchorElement>('a[download]')
    expect(link?.download).toBe('Echo Pack.zip')
    expect(link?.href).toBe('blob:custom-node')
    expect(click).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledWith(archive)
    await vi.waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:custom-node')
    })
    expect(downloadingRevisionId.value).toBeNull()
    link?.parentElement?.removeChild(link)
  })
})
