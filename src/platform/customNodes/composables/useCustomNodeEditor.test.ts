import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { useCustomNodeEditor } from './useCustomNodeEditor'

const mocks = vi.hoisted(() => ({ reloadNodeDefs: vi.fn() }))

vi.mock('@/scripts/api', () => ({
  api: { fetchApi: vi.fn() }
}))
vi.mock('@/scripts/app', () => ({
  app: { reloadNodeDefs: mocks.reloadNodeDefs }
}))

const fetchApi = vi.mocked(api.fetchApi)

const sessionDto = {
  id: 'session-1',
  mode: 'edit' as const,
  name: 'Echo Pack',
  status: 'ready' as const,
  editor_url:
    '/api/customnodes/editor/sessions/session-1/vscode/?tkn=connection-token',
  created_at: '2026-08-28T12:00:00Z',
  updated_at: '2026-08-28T12:00:01Z'
}

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: () => Promise.resolve(body)
  }) as unknown as Response

describe('useCustomNodeEditor', () => {
  beforeEach(() => {
    fetchApi.mockReset()
    mocks.reloadNodeDefs.mockReset()
  })

  it('starts an edit session with the current revision and maps its iframe URL', async () => {
    fetchApi.mockResolvedValueOnce(jsonResponse(sessionDto, true, 202))

    const { createSession } = useCustomNodeEditor()
    const session = await createSession({
      mode: 'edit',
      name: 'Echo Pack',
      revisionId: 'echo-pack-x12345678'
    })

    expect(fetchApi).toHaveBeenCalledWith('/customnodes/editor/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'edit',
        name: 'Echo Pack',
        revision_id: 'echo-pack-x12345678'
      })
    })
    expect(session.editorUrl).toBe(sessionDto.editor_url)
    expect(session.status).toBe('ready')
  })

  it('polls and abandons a session through owner-scoped routes', async () => {
    fetchApi
      .mockResolvedValueOnce(jsonResponse(sessionDto))
      .mockResolvedValueOnce(
        jsonResponse({ ...sessionDto, status: 'abandoned' as const })
      )

    const { getSession, abandonSession } = useCustomNodeEditor()
    await getSession('session-1')
    const abandoned = await abandonSession('session-1')

    expect(fetchApi.mock.calls).toEqual([
      ['/customnodes/editor/sessions/session-1', { method: 'GET' }],
      ['/customnodes/editor/sessions/session-1', { method: 'DELETE' }]
    ])
    expect(abandoned.status).toBe('abandoned')
  })

  it('refreshes the deployment before reloading browser node definitions', async () => {
    fetchApi.mockResolvedValueOnce(jsonResponse({ status: 'refreshed' }))

    const { refreshNodeDefinitions } = useCustomNodeEditor()
    await refreshNodeDefinitions('session-1')

    expect(fetchApi).toHaveBeenCalledWith(
      '/customnodes/editor/sessions/session-1/refresh',
      { method: 'POST' }
    )
    expect(mocks.reloadNodeDefs).toHaveBeenCalledOnce()
  })

  it('surfaces the manager error when session creation is rejected', async () => {
    fetchApi.mockResolvedValueOnce(
      jsonResponse(
        { error: 'the pack changed; refresh and edit its current revision' },
        false,
        409
      )
    )

    const { createSession } = useCustomNodeEditor()
    await expect(
      createSession({ mode: 'edit', name: 'Echo Pack', revisionId: 'old' })
    ).rejects.toThrow('the pack changed; refresh and edit its current revision')
  })

  it('preserves the response status when an editor session has ended', async () => {
    fetchApi.mockResolvedValueOnce(
      jsonResponse({ error: 'editor session was not found' }, false, 404)
    )

    const { getSession } = useCustomNodeEditor()
    await expect(getSession('expired-session')).rejects.toMatchObject({
      message: 'editor session was not found',
      status: 404
    })
  })
})
