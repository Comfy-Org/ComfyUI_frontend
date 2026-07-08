import type { z } from 'zod'

import {
  zAgentCancelAccepted,
  zAgentDraftSnapshot,
  zAgentError,
  zAgentMessages,
  zAgentThreadCreated,
  zAgentThreads,
  zAgentTurnAccepted,
  zUploadImageResult
} from '../../schemas/agentApiSchema'
import type {
  AgentCancelAccepted,
  AgentDraftSnapshot,
  AgentMessages,
  AgentThreadCreated,
  AgentThreadSummary,
  AgentTurnAccepted,
  UploadImageResult
} from '../../schemas/agentApiSchema'

// body is the parsed error payload, or undefined when empty or not JSON.
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

export interface AgentRestClientDeps {
  // '' targets the current origin.
  baseUrl?: string
  // Resolves the bearer token, or undefined to send unauthenticated.
  getAuthToken: () => Promise<string | undefined> | string | undefined
  fetchImpl?: typeof fetch
}

export interface PostMessageInput {
  content: string
  workflowId?: string
  selection?: Record<string, unknown>
  attachments?: string[]
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

export function createAgentRestClient(deps: AgentRestClientDeps) {
  const { baseUrl = '', getAuthToken, fetchImpl = globalThis.fetch } = deps

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getAuthToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

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

  // A schema violation throws zod's error uncaught here, by design (anti-drift seam).
  async function request<T>(
    path: string,
    init: RequestInit,
    schema: z.ZodType<T>
  ): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, init)
    if (!response.ok) throw await toApiError(response)
    return schema.parse(await response.json())
  }

  async function jsonInit(method: string, body: unknown): Promise<RequestInit> {
    return {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders())
      },
      body: JSON.stringify(body)
    }
  }

  async function createThread(
    workflowId?: string
  ): Promise<AgentThreadCreated> {
    const body = workflowId ? { workflow_id: workflowId } : {}
    return request(
      '/api/agent/threads',
      await jsonInit('POST', body),
      zAgentThreadCreated
    )
  }

  // threadId 'new' opens a thread as part of posting the first message.
  async function postMessage(
    threadId: string,
    req: PostMessageInput
  ): Promise<AgentTurnAccepted> {
    const body: Record<string, unknown> = { content: req.content }
    if (req.workflowId !== undefined) body.workflow_id = req.workflowId
    if (req.selection !== undefined) body.selection = req.selection
    if (req.attachments !== undefined) body.attachments = req.attachments
    return request(
      `/api/agent/threads/${threadId}/messages`,
      await jsonInit('POST', body),
      zAgentTurnAccepted
    )
  }

  async function getMessages(threadId: string): Promise<AgentMessages> {
    return request(
      `/api/agent/threads/${threadId}/messages`,
      { method: 'GET', headers: await authHeaders() },
      zAgentMessages
    )
  }

  async function listThreads(): Promise<AgentThreadSummary[]> {
    const page = await request(
      '/api/agent/threads',
      { method: 'GET', headers: await authHeaders() },
      zAgentThreads
    )
    return page.threads
  }

  async function cancelMessage(
    threadId: string,
    messageId: string
  ): Promise<AgentCancelAccepted> {
    return request(
      `/api/agent/threads/${threadId}/messages/${messageId}/cancel`,
      await jsonInit('POST', {}),
      zAgentCancelAccepted
    )
  }

  async function getDraft(workflowId: string): Promise<AgentDraftSnapshot> {
    const query = encodeURIComponent(workflowId)
    return request(
      `/api/agent/draft?workflow_id=${query}`,
      { method: 'GET', headers: await authHeaders() },
      zAgentDraftSnapshot
    )
  }

  // No Content-Type header is set so the browser writes the multipart boundary itself.
  async function uploadImage(
    image: Blob,
    filename: string
  ): Promise<UploadImageResult> {
    const form = new FormData()
    form.append('image', image, filename)
    return request(
      '/api/upload/image',
      { method: 'POST', headers: await authHeaders(), body: form },
      zUploadImageResult
    )
  }

  return {
    createThread,
    postMessage,
    getMessages,
    listThreads,
    cancelMessage,
    getDraft,
    uploadImage
  }
}

export type AgentRestClient = ReturnType<typeof createAgentRestClient>
