import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

export type CustomNodeEditorMode = 'create' | 'edit'
export type CustomNodeEditorAction = 'submit' | 'validate'
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

export class CustomNodeEditorRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'CustomNodeEditorRequestError'
  }
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

const readError = async (
  response: Response
): Promise<CustomNodeEditorRequestError> => {
  const data = (await response.json().catch(() => null)) as {
    error?: unknown
  } | null
  const message =
    typeof data?.error === 'string'
      ? data.error
      : typeof data?.error === 'object' &&
          data.error !== null &&
          'message' in data.error &&
          typeof data.error.message === 'string'
        ? data.error.message
        : `Request failed (${response.status})`
  return new CustomNodeEditorRequestError(message, response.status)
}

const readSession = async (
  response: Response
): Promise<CustomNodeEditorSession> => {
  if (!response.ok) throw await readError(response)
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

  const renameSession = async (
    id: string,
    name: string
  ): Promise<CustomNodeEditorSession> =>
    readSession(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() })
        }
      )
    )

  const abandonSession = async (id: string): Promise<CustomNodeEditorSession> =>
    readSession(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
    )

  const runSessionAction = async (
    id: string,
    action: CustomNodeEditorAction
  ): Promise<CustomNodeEditorSession> =>
    readSession(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        }
      )
    )

  const refreshNodeDefinitions = async (id: string): Promise<void> => {
    const response = await api.fetchApi(
      `/customnodes/editor/sessions/${encodeURIComponent(id)}/refresh`,
      { method: 'POST' }
    )
    if (!response.ok) throw await readError(response)
    await app.reloadNodeDefs()
  }

  return {
    createSession,
    getSession,
    renameSession,
    runSessionAction,
    abandonSession,
    refreshNodeDefinitions
  }
}
