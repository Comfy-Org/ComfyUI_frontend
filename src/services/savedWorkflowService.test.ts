import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { fetchSavedWorkflow } from './savedWorkflowService'

vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'))

const id = 'c327cae8-2acf-4bfa-bb88-97948a3c008b'
const graph = {
  version: 0.4,
  nodes: [],
  links: [],
  last_node_id: 0,
  last_link_id: 0
}
const snapshot = {
  id,
  path: 'workflows/renamed.json',
  content: JSON.stringify(graph),
  modified: 123,
  size: 87
}

describe('saved-file snapshot reads', () => {
  it('uses the exact UUID-bound path and bytes without a path read or name association', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json(snapshot))
    await expect(fetchSavedWorkflow(id)).resolves.toEqual({
      ok: true,
      ...snapshot,
      workflow: graph
    })
    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      `/userdata-files/${id}`,
      { signal: undefined }
    )
    expect(api.getUserData).not.toHaveBeenCalled()
    expect(api.storeUserData).not.toHaveBeenCalled()
  })

  it.for([401, 403, 404, 412, 422, 500])(
    'refuses an unavailable UUID snapshot (%s)',
    async (status) => {
      vi.mocked(api.fetchApi).mockResolvedValue(new Response(null, { status }))
      await expect(fetchSavedWorkflow(id)).resolves.toMatchObject({
        ok: false,
        status
      })
      expect(api.getUserData).not.toHaveBeenCalled()
    }
  )

  it.for([
    { ...snapshot, id: '78ebcb5b-028d-45e8-9f9c-b20f433c364d' },
    { ...snapshot, id: id.toUpperCase() },
    { ...snapshot, path: 'workflows/../private.json' },
    { ...snapshot, path: 'workflows/a\\b.json' },
    { ...snapshot, path: 'settings.json' },
    { ...snapshot, path: 'workflows/.index.json' },
    { ...snapshot, path: 'workflows/folder/.json' },
    { ...snapshot, path: 'workflows/test.txt' },
    {
      ...snapshot,
      content: JSON.stringify({ '1': { class_type: 'SaveImage', inputs: {} } })
    },
    { ...snapshot, content: '{' },
    { ...snapshot, modified: '2026-10-30T00:00:00Z' },
    { ...snapshot, modified: 0.5 },
    { ...snapshot, modified: Number.MAX_SAFE_INTEGER + 1 },
    { ...snapshot, size: -1 }
  ])('refuses an uncertified snapshot %j', async (body) => {
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json(body))
    await expect(fetchSavedWorkflow(id)).resolves.toMatchObject({ ok: false })
    expect(api.getUserData).not.toHaveBeenCalled()
  })

  it('does not read after cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      fetchSavedWorkflow(id, controller.signal)
    ).resolves.toMatchObject({ ok: false, reason: 'cancelled' })
    expect(api.fetchApi).not.toHaveBeenCalled()
  })
})
