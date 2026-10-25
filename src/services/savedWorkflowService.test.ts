import type {
  GetWorkflowContentResponse,
  GetWorkflowResponse
} from '@comfyorg/ingest-types'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { reportError } from '@/platform/telemetry/reportError'

import { fetchSavedWorkflow } from './savedWorkflowService'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/telemetry/reportError'))

const workflowId = 'c327cae8-2acf-4bfa-bb88-97948a3c008b'
const metadata: GetWorkflowResponse = {
  id: workflowId,
  name: 'My private workflow',
  created_at: '2026-10-24T00:00:00Z',
  updated_at: '2026-10-24T00:00:00Z',
  created_by: 'user-1',
  latest_version: 1
}
const graph = {
  version: 0.4,
  nodes: [],
  links: [],
  last_node_id: 0,
  last_link_id: 0
}
const content: GetWorkflowContentResponse = {
  id: 'version-1',
  version: 1,
  created_at: '2026-10-24T00:00:00Z',
  created_by: 'user-1',
  workflow_json: graph
}

describe('saved workflow reads', () => {
  it('loads private record content through the authenticated API without publishing or saving anything', async () => {
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(Response.json(metadata))
      .mockResolvedValueOnce(Response.json(content))
    vi.mocked(api.getUserData).mockResolvedValue(Response.json(graph))

    const saved = await fetchSavedWorkflow(workflowId)

    expect(saved).toEqual({
      ok: true,
      metadata,
      workflow: graph,
      path: 'workflows/My private workflow.json'
    })
    expect(vi.mocked(api.fetchApi).mock.calls.map(([url]) => url)).toEqual([
      `/workflows/${workflowId}`,
      `/workflows/${workflowId}/content`
    ])
    expect(api.storeUserData).not.toHaveBeenCalled()
  })

  it('does not fetch private data after cancellation', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      fetchSavedWorkflow(workflowId, controller.signal)
    ).resolves.toMatchObject({ ok: false, reason: 'cancelled' })
    expect(api.fetchApi).not.toHaveBeenCalled()
  })

  it.for([401, 403, 404, 500])(
    'propagates a private record access failure (%s) without loading a graph',
    async (status) => {
      vi.mocked(api.fetchApi).mockResolvedValue(new Response(null, { status }))

      await expect(fetchSavedWorkflow(workflowId)).resolves.toMatchObject({
        ok: false,
        status
      })
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'error_loading_saved_workflow_link'
        })
      )
    }
  )

  it.for([
    {
      label: 'an unrelated record',
      metadata: { ...metadata, id: 'another-record' }
    },
    { label: 'an invalid metadata response', metadata: { name: 'unknown' } }
  ])('rejects $label', async (response) => {
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json(response.metadata))

    await expect(fetchSavedWorkflow(workflowId)).resolves.toMatchObject({
      ok: false
    })
  })

  it.for([
    { label: 'a malformed content response', body: {} },
    {
      label: 'an API graph without an editing canvas',
      body: {
        ...content,
        workflow_json: { '1': { class_type: 'SaveImage', inputs: {} } }
      }
    },
    {
      label: 'an invalid editing graph',
      body: { ...content, workflow_json: { version: 0.4, nodes: 'invalid' } }
    },
    {
      label: 'an editing graph without a version',
      body: { ...content, workflow_json: { nodes: [] } }
    },
    {
      label: 'an editing graph with an incomplete node',
      body: { ...content, workflow_json: { ...graph, nodes: [{}] } }
    }
  ])('rejects $label', async ({ body }) => {
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(Response.json(metadata))
      .mockResolvedValueOnce(Response.json(body))

    await expect(fetchSavedWorkflow(workflowId)).resolves.toMatchObject({
      ok: false
    })
  })

  it.for([
    '../escape',
    '/absolute',
    'folder\\private',
    'https://untrusted.example/file',
    ''
  ])(
    'refuses to infer an editable file from unsafe record name %s',
    async (name) => {
      vi.mocked(api.fetchApi)
        .mockResolvedValueOnce(Response.json({ ...metadata, name }))
        .mockResolvedValueOnce(Response.json(content))

      await expect(fetchSavedWorkflow(workflowId)).resolves.toMatchObject({
        ok: false,
        reason: 'file_unavailable'
      })
      expect(api.getUserData).not.toHaveBeenCalled()
    }
  )

  it('does not open an unrelated sidebar file that happens to have the same name', async () => {
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(Response.json(metadata))
      .mockResolvedValueOnce(Response.json(content))
    vi.mocked(api.getUserData).mockResolvedValue(
      Response.json({ ...graph, nodes: [{ id: 1, type: 'PrivateNode' }] })
    )

    await expect(fetchSavedWorkflow(workflowId)).resolves.toMatchObject({
      ok: false,
      reason: 'file_mismatch'
    })
  })

  it('reports a record-only save without creating a file or temporary workflow', async () => {
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(Response.json(metadata))
      .mockResolvedValueOnce(Response.json(content))
    vi.mocked(api.getUserData).mockResolvedValue(
      new Response(null, { status: 404 })
    )

    await expect(fetchSavedWorkflow(workflowId)).resolves.toMatchObject({
      ok: false,
      reason: 'file_unavailable'
    })
    expect(api.storeUserData).not.toHaveBeenCalled()
  })
})
