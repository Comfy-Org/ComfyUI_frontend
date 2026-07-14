import type { z } from 'zod'

import { api } from '@/scripts/api'

import {
  zAgentCancelAccepted,
  zAgentDraftSnapshot,
  zAgentError,
  zAgentMessages,
  zAgentThreads,
  zAgentTurnAccepted,
  zCloudWorkflowIndex,
  zUploadImageResult
} from '../../schemas/agentApiSchema'
import type {
  AgentCancelAccepted,
  AgentDraftSnapshot,
  AgentMessages,
  AgentThreadSummary,
  AgentTurnAccepted,
  CloudWorkflowEntry,
  UploadImageResult
} from '../../schemas/agentApiSchema'

const CLOUD_WORKFLOW_PAGE_SIZE = 100
const CLOUD_WORKFLOW_MAX_PAGES = 5

export class AgentApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'AgentApiError'
    this.status = status
    this.body = body
  }
}

export interface DraftUpload {
  content: unknown
  version: number | null
}

interface OpenTabEntry {
  workflow_id: string
  name: string
}

export interface OpenTabsSnapshot {
  open_tabs: OpenTabEntry[]
  current_tab?: string
}

export interface PostMessageInput {
  content: string
  workflowId?: string
  selection?: Record<string, unknown>
  attachments?: string[]
  draft?: DraftUpload
  tabs?: OpenTabsSnapshot
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

export function createAgentRestClient() {
  async function toApiError(response: Response): Promise<AgentApiError> {
    const text = await response.text()
    let body: unknown
    try {
      body = text.length > 0 ? JSON.parse(text) : undefined
    } catch {
      body = undefined
    }
    const plain = zAgentError.safeParse(body)
    const message = plain.success
      ? plain.data.error
      : isIngestErrorBody(body)
        ? body.error.message
        : response.statusText
    return new AgentApiError(message, response.status, body)
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
    if (req.selection !== undefined) body.selection = req.selection
    if (req.attachments !== undefined) body.attachments = req.attachments
    if (req.draft !== undefined) body.draft = req.draft
    return request(
      `/agent/threads/${threadId}/messages`,
      jsonInit('POST', body),
      zAgentTurnAccepted
    )
  }

  async function getMessages(threadId: string): Promise<AgentMessages> {
    return request(
      `/agent/threads/${threadId}/messages`,
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

  async function listCloudWorkflows(): Promise<CloudWorkflowEntry[]> {
    const entries: CloudWorkflowEntry[] = []
    let hasMore = false
    for (let page = 0; page < CLOUD_WORKFLOW_MAX_PAGES; page++) {
      const result = await request(
        `/workflows?limit=${CLOUD_WORKFLOW_PAGE_SIZE}&offset=${page * CLOUD_WORKFLOW_PAGE_SIZE}`,
        { method: 'GET' },
        zCloudWorkflowIndex
      )
      entries.push(...result.data)
      hasMore = result.pagination.has_more
      if (!hasMore) break
    }
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
      `/agent/threads/${threadId}/messages/${messageId}/cancel`,
      jsonInit('POST', {}),
      zAgentCancelAccepted
    )
  }

  async function getDraft(workflowId: string): Promise<AgentDraftSnapshot> {
    const query = encodeURIComponent(workflowId)
    return request(
      `/agent/draft?workflow_id=${query}`,
      { method: 'GET' },
      zAgentDraftSnapshot
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
    listCloudWorkflows,
    cancelMessage,
    getDraft,
    uploadImage
  }
}

export type AgentRestClient = ReturnType<typeof createAgentRestClient>
