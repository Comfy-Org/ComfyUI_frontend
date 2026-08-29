import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

export type CustomNodeEditorMode = 'create' | 'edit'
export type CustomNodeEditorStatus =
  | 'creating'
  | 'ready'
  | 'submitting'
  | 'submitted'
  | 'abandoned'
  | 'failed'

export interface CustomNodeEditorSession {
  id: string
  mode: CustomNodeEditorMode
  name: string
  status: CustomNodeEditorStatus
  editorUrl?: string
  error?: string
  revisionId?: string
  createdAt: string
  updatedAt: string
}

interface CustomNodeEditorSessionDto {
  id: string
  mode: CustomNodeEditorMode
  name: string
  status: CustomNodeEditorStatus
  editor_url?: string
  error?: string
  revision_id?: string
  created_at: string
  updated_at: string
}

interface CreateCustomNodeEditorSession {
  mode: CustomNodeEditorMode
  name: string
  revisionId?: string
}

const toSession = (
  session: CustomNodeEditorSessionDto
): CustomNodeEditorSession => ({
  id: session.id,
  mode: session.mode,
  name: session.name,
  status: session.status,
  editorUrl: session.editor_url,
  error: session.error,
  revisionId: session.revision_id,
  createdAt: session.created_at,
  updatedAt: session.updated_at
})

const readError = async (response: Response): Promise<string> => {
  const data = (await response.json().catch(() => null)) as {
    error?: unknown
  } | null
  return typeof data?.error === 'string'
    ? data.error
    : `Request failed (${response.status})`
}

const readSession = async (
  response: Response
): Promise<CustomNodeEditorSession> => {
  if (!response.ok) throw new Error(await readError(response))
  return toSession((await response.json()) as CustomNodeEditorSessionDto)
}

export function useCustomNodeEditor() {
  const createSession = async ({
    mode,
    name,
    revisionId
  }: CreateCustomNodeEditorSession): Promise<CustomNodeEditorSession> =>
    readSession(
      await api.fetchApi('/customnodes/editor/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          name: name.trim(),
          ...(revisionId ? { revision_id: revisionId } : {})
        })
      })
    )

  const getSession = async (id: string): Promise<CustomNodeEditorSession> =>
    readSession(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}`,
        { method: 'GET' }
      )
    )

  const abandonSession = async (id: string): Promise<CustomNodeEditorSession> =>
    readSession(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
    )

  const refreshNodeDefinitions = async (id: string): Promise<void> => {
    const response = await api.fetchApi(
      `/customnodes/editor/sessions/${encodeURIComponent(id)}/refresh`,
      { method: 'POST' }
    )
    if (!response.ok) throw new Error(await readError(response))
    await app.reloadNodeDefs()
  }

  return {
    createSession,
    getSession,
    abandonSession,
    refreshNodeDefinitions
  }
}
