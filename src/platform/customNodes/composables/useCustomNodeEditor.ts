import type {
  CustomNodeEditorDraftTest as CustomNodeEditorDraftTestDto,
  CustomNodeEditorDraftTestError,
  CustomNodeEditorDraftTestOutput,
  CustomNodeEditorDraftTestRequest,
  CustomNodeEditorDraftTestResult,
  CustomNodeEditorProposal as GeneratedCustomNodeEditorProposal,
  CustomNodeEditorTestResult as CustomNodeEditorTestResultDto
} from '@comfyorg/ingest-types'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

type CustomNodeEditorMode = 'create' | 'edit'
export type CustomNodeEditorAction = 'submit' | 'validate'
type CustomNodeEditorKind = 'workbench' | 'vscode'
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
  editorKind: CustomNodeEditorKind
  agentEnabled: boolean
  agentBusy: boolean
  agentActivity: string[]
  createdAt: string
  updatedAt: string
}

export interface CustomNodeEditorFile {
  path: string
  content: string
  editable: boolean
}

export interface CustomNodeEditorFiles {
  files: CustomNodeEditorFile[]
  directories: string[]
  initialPath?: string
  digest: string
}

export type CustomNodeEditorOperation =
  | {
      kind: 'replace_text'
      path: string
      oldText: string
      newText: string
    }
  | { kind: 'replace_file'; path: string; content: string }
  | { kind: 'create_file'; path: string; content: string }
  | { kind: 'create_directory'; path: string }
  | { kind: 'move_file'; path: string; destination: string }
  | { kind: 'delete_file'; path: string }

export type CustomNodeEditorProposalChangeKind =
  | 'modified'
  | 'created'
  | 'deleted'
  | 'moved'
  | 'directory_created'

export interface CustomNodeEditorProposalChange {
  kind: CustomNodeEditorProposalChangeKind
  path: string
  destinationPath?: string
  originalContent: string
  proposedContent: string
}

export type CustomNodeEditorTestStatus = CustomNodeEditorTestResultDto['status']

interface CustomNodeEditorTestResultView {
  status: CustomNodeEditorTestStatus
  summary: string
  testId?: string
  phase?: CustomNodeEditorTestResultDto['phase']
  sandbox?: string
  durationMs: number
  stdout: string
  stderr: string
  outputs: CustomNodeEditorDraftTestOutput[]
  error?: CustomNodeEditorDraftTestError
}

export interface CustomNodeEditorDraftTestView {
  id: string
  status: CustomNodeEditorDraftTestDto['status']
  draftDigest: string
  workflowPath: string
  error?: string
  result?: CustomNodeEditorDraftTestResult
  createdAt: string
  updatedAt: string
}

export interface CustomNodeEditorProposalView {
  id: string
  summary: string
  changes: CustomNodeEditorProposalChange[]
  test?: CustomNodeEditorTestResultView
  createdAt: string
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

export interface CustomNodeEditorSessionDto {
  id: string
  mode: CustomNodeEditorMode
  name: string
  status: CustomNodeEditorStatus
  editor_url?: string
  error?: string
  revision_id?: string
  editor_kind?: CustomNodeEditorKind
  agent_enabled?: boolean
  agent_busy?: boolean
  agent_activity?: string[]
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
  editorKind: session.editor_kind ?? 'vscode',
  agentEnabled: session.agent_enabled ?? false,
  agentBusy: session.agent_busy ?? false,
  agentActivity: session.agent_activity ?? [],
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

interface CustomNodeEditorFileDto {
  path: string
  content: string
  editable: boolean
}

export interface CustomNodeEditorFilesDto {
  files: CustomNodeEditorFileDto[]
  directories?: string[]
  initial_path?: string
  digest?: string
}

export type CustomNodeEditorProposalDto = GeneratedCustomNodeEditorProposal

const readFiles = async (
  response: Response
): Promise<CustomNodeEditorFiles> => {
  if (!response.ok) throw await readError(response)
  const data = (await response.json()) as CustomNodeEditorFilesDto
  return {
    files: data.files,
    directories: data.directories ?? [],
    initialPath: data.initial_path,
    digest: data.digest ?? ''
  }
}

const readProposal = async (
  response: Response
): Promise<CustomNodeEditorProposalView> => {
  if (!response.ok) throw await readError(response)
  const data = (await response.json()) as CustomNodeEditorProposalDto
  return {
    id: data.id,
    summary: data.summary,
    changes: data.changes.map((change) => ({
      kind: change.kind,
      path: change.path,
      destinationPath: change.destination_path,
      originalContent: change.original_content,
      proposedContent: change.proposed_content
    })),
    test: data.test
      ? {
          status: data.test.status,
          summary: data.test.summary,
          testId: data.test.test_id,
          phase: data.test.phase,
          sandbox: data.test.sandbox,
          durationMs: data.test.duration_ms,
          stdout: data.test.stdout ?? '',
          stderr: data.test.stderr ?? '',
          outputs: data.test.outputs ?? [],
          error: data.test.error
        }
      : undefined,
    createdAt: data.created_at
  }
}

const readDraftTest = async (
  response: Response
): Promise<CustomNodeEditorDraftTestView> => {
  if (!response.ok) throw await readError(response)
  const data = (await response.json()) as CustomNodeEditorDraftTestDto
  return {
    id: data.id,
    status: data.status,
    draftDigest: data.draft_digest,
    workflowPath: data.workflow_path,
    error: data.error,
    result: data.result,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
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

  const getFiles = async (id: string): Promise<CustomNodeEditorFiles> =>
    readFiles(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}/files`,
        { method: 'GET' }
      )
    )

  const saveFiles = async (
    id: string,
    files: CustomNodeEditorFile[]
  ): Promise<CustomNodeEditorFiles> =>
    readFiles(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}/files`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: files.map(({ path, content }) => ({ path, content }))
          })
        }
      )
    )

  const applyOperations = async (
    id: string,
    operations: CustomNodeEditorOperation[],
    baselineDigest: string
  ): Promise<CustomNodeEditorFiles> =>
    readFiles(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}/files`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseline_digest: baselineDigest,
            operations: operations.map((operation) => ({
              kind: operation.kind,
              path: operation.path,
              ...('destination' in operation
                ? { destination: operation.destination }
                : {}),
              ...('oldText' in operation
                ? {
                    old_text: operation.oldText,
                    new_text: operation.newText
                  }
                : {}),
              ...('content' in operation ? { content: operation.content } : {})
            }))
          })
        }
      )
    )

  const createAgentProposal = async (
    id: string,
    instruction: string,
    signal?: AbortSignal
  ): Promise<CustomNodeEditorProposalView> =>
    readProposal(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}/agent/proposals`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction: instruction.trim() }),
          signal
        }
      )
    )

  const applyAgentProposal = async (
    id: string,
    proposalId: string
  ): Promise<CustomNodeEditorFiles> =>
    readFiles(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}/agent/proposals/${encodeURIComponent(proposalId)}/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        }
      )
    )

  const restoreCheckpoint = async (
    id: string,
    checkpointId: string
  ): Promise<CustomNodeEditorFiles> =>
    readFiles(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}/checkpoints/${encodeURIComponent(checkpointId)}/restore`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        }
      )
    )

  const createDraftTest = async (
    id: string,
    test: CustomNodeEditorDraftTestRequest
  ): Promise<CustomNodeEditorDraftTestView> =>
    readDraftTest(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}/tests`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(test)
        }
      )
    )

  const getDraftTest = async (
    id: string,
    testId: string
  ): Promise<CustomNodeEditorDraftTestView> =>
    readDraftTest(
      await api.fetchApi(
        `/customnodes/editor/sessions/${encodeURIComponent(id)}/tests/${encodeURIComponent(testId)}`,
        { method: 'GET' }
      )
    )

  const deleteDraftTest = async (id: string, testId: string): Promise<void> => {
    const response = await api.fetchApi(
      `/customnodes/editor/sessions/${encodeURIComponent(id)}/tests/${encodeURIComponent(testId)}`,
      { method: 'DELETE' }
    )
    if (!response.ok) throw await readError(response)
  }

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
    getFiles,
    saveFiles,
    applyOperations,
    createAgentProposal,
    applyAgentProposal,
    restoreCheckpoint,
    createDraftTest,
    getDraftTest,
    deleteDraftTest,
    abandonSession,
    refreshNodeDefinitions
  }
}
