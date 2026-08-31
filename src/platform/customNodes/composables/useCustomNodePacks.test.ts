import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { useCustomNodePacks } from './useCustomNodePacks'

const mocks = vi.hoisted(() => ({ reloadNodeDefs: vi.fn() }))

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
