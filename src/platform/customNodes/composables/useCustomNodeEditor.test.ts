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
  editor_kind: 'vscode' as const,
  agent_enabled: false,
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
    expect(session.editorKind).toBe('vscode')
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

  it('renames a session through its owner-scoped route', async () => {
    fetchApi.mockResolvedValueOnce(
      jsonResponse({ ...sessionDto, name: 'Gradient Mask' })
    )

    const { renameSession } = useCustomNodeEditor()
    const renamed = await renameSession('session-1', ' Gradient Mask ')

    expect(fetchApi).toHaveBeenCalledWith(
      '/customnodes/editor/sessions/session-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Gradient Mask' })
      }
    )
    expect(renamed.name).toBe('Gradient Mask')
  })

  it('runs editor actions through the authenticated session route', async () => {
    fetchApi.mockResolvedValueOnce(
      jsonResponse({
        ...sessionDto,
        status: 'submitted' as const,
        revision_id: 'echo-pack-x87654321'
      })
    )

    const { runSessionAction } = useCustomNodeEditor()
    const submitted = await runSessionAction('session-1', 'submit')

    expect(fetchApi).toHaveBeenCalledWith(
      '/customnodes/editor/sessions/session-1/actions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' })
      }
    )
    expect(submitted.status).toBe('submitted')
    expect(submitted.revisionId).toBe('echo-pack-x87654321')
  })

  it('loads and saves browser-workbench files', async () => {
    const filesDto = {
      files: [
        {
          path: 'v2/nodes/checkerboard.py',
          content: '# checkerboard\n',
          editable: true
        }
      ],
      directories: ['v2', 'v2/nodes'],
      initial_path: 'v2/nodes/checkerboard.py',
      digest: 'digest-1'
    }
    fetchApi
      .mockResolvedValueOnce(jsonResponse(filesDto))
      .mockResolvedValueOnce(jsonResponse(filesDto))

    const { getFiles, saveFiles } = useCustomNodeEditor()
    const loaded = await getFiles('session-1')
    await saveFiles('session-1', loaded.files)

    expect(loaded.initialPath).toBe('v2/nodes/checkerboard.py')
    expect(loaded.directories).toEqual(['v2', 'v2/nodes'])
    expect(loaded.digest).toBe('digest-1')
    expect(fetchApi.mock.calls).toEqual([
      ['/customnodes/editor/sessions/session-1/files', { method: 'GET' }],
      [
        '/customnodes/editor/sessions/session-1/files',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: [
              {
                path: 'v2/nodes/checkerboard.py',
                content: '# checkerboard\n'
              }
            ]
          })
        }
      ]
    ])
  })

  it('applies stale-safe structured project operations', async () => {
    fetchApi.mockResolvedValueOnce(
      jsonResponse({
        files: [],
        directories: ['v2', 'v2/nodes', 'v2/nodes/helpers'],
        digest: 'digest-2'
      })
    )

    const { applyOperations } = useCustomNodeEditor()
    const updated = await applyOperations(
      'session-1',
      [
        { kind: 'create_directory', path: 'v2/nodes/helpers' },
        {
          kind: 'create_file',
          path: 'v2/nodes/helpers/example.py',
          content: '# example\n'
        },
        {
          kind: 'move_file',
          path: 'README.md',
          destination: 'GUIDE.md'
        },
        { kind: 'delete_file', path: 'v2/web/js/checkerboard.js' }
      ],
      'digest-1'
    )

    expect(updated.digest).toBe('digest-2')
    expect(fetchApi).toHaveBeenCalledWith(
      '/customnodes/editor/sessions/session-1/files',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseline_digest: 'digest-1',
          operations: [
            { kind: 'create_directory', path: 'v2/nodes/helpers' },
            {
              kind: 'create_file',
              path: 'v2/nodes/helpers/example.py',
              content: '# example\n'
            },
            {
              kind: 'move_file',
              path: 'README.md',
              destination: 'GUIDE.md'
            },
            { kind: 'delete_file', path: 'v2/web/js/checkerboard.js' }
          ]
        })
      }
    )
  })

  it('creates and explicitly applies a Node Agent proposal', async () => {
    fetchApi
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: 'proposal-1',
            summary: 'Changed the checkerboard.',
            changes: [
              {
                kind: 'modified',
                path: 'v2/nodes/checkerboard.py',
                original_content: '# before\n',
                proposed_content: '# after\n'
              }
            ],
            test: {
              status: 'passed',
              summary: 'Workflow completed with 1 output node(s).',
              prompt_id: 'prompt-1',
              duration_ms: 842,
              output_nodes: ['3']
            },
            created_at: '2026-08-29T12:00:00Z'
          },
          true,
          201
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          files: [
            {
              path: 'v2/nodes/checkerboard.py',
              content: '# after\n',
              editable: true
            }
          ],
          directories: ['v2', 'v2/nodes'],
          initial_path: 'v2/nodes/checkerboard.py',
          digest: 'digest-2'
        })
      )

    const { createAgentProposal, applyAgentProposal } = useCustomNodeEditor()
    const proposal = await createAgentProposal('session-1', ' Change it ')
    const applied = await applyAgentProposal('session-1', proposal.id)

    expect(proposal.changes[0].originalContent).toBe('# before\n')
    expect(proposal.changes[0].kind).toBe('modified')
    expect(proposal.test).toEqual({
      status: 'passed',
      summary: 'Workflow completed with 1 output node(s).',
      promptId: 'prompt-1',
      durationMs: 842,
      outputNodes: ['3']
    })
    expect(applied.files[0].content).toBe('# after\n')
    expect(fetchApi.mock.calls).toEqual([
      [
        '/customnodes/editor/sessions/session-1/agent/proposals',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction: 'Change it' })
        }
      ],
      [
        '/customnodes/editor/sessions/session-1/agent/proposals/proposal-1/apply',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        }
      ]
    ])
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
