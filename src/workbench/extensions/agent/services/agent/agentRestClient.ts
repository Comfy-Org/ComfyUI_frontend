import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import type { z } from 'zod'

import { api } from '@/scripts/api'

import {
  zAgentAnswerAccepted,
  zAgentCancelAccepted,
  zAgentError,
  zAgentMessages,
  zAgentRunMode,
  zAgentThreads,
  zAgentTurnAccepted,
  zCloudWorkflowIndex,
  zUploadImageResult
} from '../../schemas/agentApiSchema'
import type {
  AgentAnswerAccepted,
  AgentCancelAccepted,
  AgentMessages,
  AgentRunModePreference,
  AgentThreadSummary,
  AgentTurnAccepted,
  CloudWorkflowEntry,
  UploadImageResult
} from '../../schemas/agentApiSchema'

const CLOUD_WORKFLOW_PAGE_SIZE = 100

export class AgentApiError extends Error {
  readonly status: number
  readonly body: unknown
  readonly retryAfterSeconds?: number

  constructor(
    message: string,
    status: number,
    body: unknown,
    retryAfterSeconds?: number
  ) {
    super(message)
    this.name = 'AgentApiError'
    this.status = status
    this.body = body
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export type OpenTabsSnapshot = Pick<
  AgentPostMessageRequest,
  'open_tabs' | 'current_tab'
>

/** An omitted `version` makes this content authoritative for the backend CAS. */
export interface DraftSnapshot {
  content: Record<string, unknown>
  version?: number
}

export interface PostMessageInput {
  content: string
  workflowId?: string
  selection?: Record<string, unknown>
  attachments?: string[]
  workflowReferences?: AgentPostMessageRequest['workflow_references']
  tabs?: OpenTabsSnapshot
  draft?: DraftSnapshot
  /**
   * The turn's target tab has no cloud id yet (a fresh, unsaved tab) - see
   * AgentPostMessageRequest['current_tab_unbound']. Tells the server this is
   * a selected-but-unbound tab rather than no tab at all, so it mints a
   * workflow for it instead of falling back to the thread's previous one and
   * presenting the turn to the model as having no workflow selected.
   */
  currentTabUnbound?: boolean
}

interface IngestErrorBody {
  error: { message: string }
}

function isIngestErrorBody(body: unknown): body is IngestErrorBody {
  if (typeof body !== 'object' || body === null) return false
  const { error } = body as { error?: unknown }
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { message?: unknown }).message === 'string'
  )
}

function parseErrorBody(text: string): unknown {
  if (text.length === 0) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function getErrorMessage(body: unknown, fallback: string): string {
  const plain = zAgentError.safeParse(body)
  if (plain.success) {
    return typeof plain.data.error === 'string'
      ? plain.data.error
      : plain.data.error.message
  }
  return isIngestErrorBody(body) ? body.error.message : fallback
}

function parseRetryAfter(header: string | null): number | undefined {
  if (header === null) return undefined
  if (/^\d+$/.test(header)) return Number(header)
  if (Number.isFinite(Number(header))) return undefined
  return Math.max(0, Math.ceil((Date.parse(header) - Date.now()) / 1000))
}

export function createAgentRestClient() {
  async function toApiError(response: Response): Promise<AgentApiError> {
    const body = parseErrorBody(await response.text())
    const message = getErrorMessage(body, response.statusText)
    const retryAfterSeconds = parseRetryAfter(
      response.headers.get('Retry-After')
    )
    return new AgentApiError(
      message,
      response.status,
      body,
      Number.isSafeInteger(retryAfterSeconds) ? retryAfterSeconds : undefined
    )
  }

  async function request<T>(
    route: string,
    init: RequestInit,
    schema: z.ZodType<T>
  ): Promise<T> {
    const response = await api.fetchApi(route, init)
    if (!response.ok) throw await toApiError(response)
    return schema.parse(await response.json())
  }

  function jsonInit(method: string, body: unknown): RequestInit {
    return {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  }

  async function postMessage(
    threadId: string,
    req: PostMessageInput
  ): Promise<AgentTurnAccepted> {
    const body: Record<string, unknown> = { content: req.content }
    if (req.workflowId !== undefined) body.workflow_id = req.workflowId
    if (req.tabs !== undefined) {
      body.open_tabs = req.tabs.open_tabs
      if (req.tabs.current_tab !== undefined)
        body.current_tab = req.tabs.current_tab
    }
    if (req.workflowReferences !== undefined)
      body.workflow_references = req.workflowReferences
    if (req.selection !== undefined) body.selection = req.selection
    if (req.attachments !== undefined) body.attachments = req.attachments
    if (req.draft !== undefined) body.draft = req.draft
    if (req.currentTabUnbound !== undefined)
      body.current_tab_unbound = req.currentTabUnbound
    return request(
      `/agent/threads/${encodeURIComponent(threadId)}/messages`,
      jsonInit('POST', body),
      zAgentTurnAccepted
    )
  }

  async function getMessages(threadId: string): Promise<AgentMessages> {
    return request(
      `/agent/threads/${encodeURIComponent(threadId)}/messages`,
      { method: 'GET' },
      zAgentMessages
    )
  }

  async function listThreads(): Promise<AgentThreadSummary[]> {
    const page = await request(
      '/agent/threads',
      { method: 'GET' },
      zAgentThreads
    )
    return page.threads
  }

  async function getRunMode(): Promise<AgentRunModePreference> {
    return request('/agent/run-mode', { method: 'GET' }, zAgentRunMode)
  }

  async function putRunMode(
    preference: AgentRunModePreference
  ): Promise<AgentRunModePreference> {
    return request(
      '/agent/run-mode',
      jsonInit('PUT', preference),
      zAgentRunMode
    )
  }

  async function listCloudWorkflows(): Promise<CloudWorkflowEntry[]> {
    const entries: CloudWorkflowEntry[] = []
    let hasMore: boolean
    let cursor: string | undefined
    const seenCursors = new Set<string>()
    do {
      const after = cursor ? `&after=${encodeURIComponent(cursor)}` : ''
      const result = await request(
        `/workflows?limit=${CLOUD_WORKFLOW_PAGE_SIZE}${after}`,
        { method: 'GET' },
        zCloudWorkflowIndex
      )
      entries.push(...result.data)
      hasMore = result.pagination.has_more
      if (hasMore) {
        const nextCursor = result.pagination.next_cursor
        if (!nextCursor || seenCursors.has(nextCursor)) break
        seenCursors.add(nextCursor)
        cursor = nextCursor
      }
    } while (hasMore)
    if (hasMore)
      console.warn(
        `[agent] cloud workflow index truncated at ${entries.length} entries`
      )
    return entries
  }

  async function cancelMessage(
    threadId: string,
    messageId: string
  ): Promise<AgentCancelAccepted> {
    return request(
      `/agent/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/cancel`,
      jsonInit('POST', {}),
      zAgentCancelAccepted
    )
  }

  async function answerAsk(
    threadId: string,
    askId: string,
    selected: string[]
  ): Promise<AgentAnswerAccepted> {
    return request(
      `/agent/threads/${encodeURIComponent(threadId)}/asks/${encodeURIComponent(askId)}/answer`,
      jsonInit('POST', { selected }),
      zAgentAnswerAccepted
    )
  }

  async function uploadImage(
    image: Blob,
    filename: string
  ): Promise<UploadImageResult> {
    const form = new FormData()
    form.append('image', image, filename)
    return request(
      '/upload/image',
      { method: 'POST', body: form },
      zUploadImageResult
    )
  }

  return {
    postMessage,
    getMessages,
    listThreads,
    getRunMode,
    putRunMode,
    listCloudWorkflows,
    cancelMessage,
    answerAsk,
    uploadImage
  }
}

export type AgentRestClient = ReturnType<typeof createAgentRestClient>
