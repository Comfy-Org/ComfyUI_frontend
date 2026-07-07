import type { z } from 'zod'

import {
  zAgentCancelAccepted,
  zAgentDraftSnapshot,
  zAgentError,
  zAgentMessages,
  zAgentThreadCreated,
  zAgentTurnAccepted,
  zUploadImageResult
} from '../../schemas/agentApiSchema'
import type {
  AgentCancelAccepted,
  AgentDraftSnapshot,
  AgentMessages,
  AgentThreadCreated,
  AgentTurnAccepted,
  UploadImageResult
} from '../../schemas/agentApiSchema'

/**
 * agentRestClient: the ONE place the agent's REST surface is spoken. Every
 * response is parsed through the shared agentApiSchema, so a wire change surfaces
 * as a zod parse error at the seam rather than silent drift downstream. It owns no
 * retries, timeouts, or logging: the caller surfaces failures.
 */

// Thrown on any non-2xx response. body is the parsed error payload (whatever the
// server sent) or undefined when the body was empty or not JSON.
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
  // Origin prefix for every path; '' targets the current origin.
  baseUrl?: string
  // Resolves the bearer token, or undefined to send the request unauthenticated.
  getAuthToken: () => Promise<string | undefined> | string | undefined
  fetchImpl?: typeof fetch
}

// The wire request shape for postMessage; the caller passes camelCase and the
// client maps to the snake_case wire keys, omitting absent optionals entirely.
export interface PostMessageInput {
  content: string
  workflowId?: string
  selection?: Record<string, unknown>
  attachments?: string[]
}

// The ingest-raised error shape ({error: {message, type}}), narrower than a full
// schema: only message is read for the AgentApiError message.
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

  // Non-2xx: read the body as text, try to parse it as JSON, and resolve a message
  // from the plain-string error shape, then the ingest shape, then statusText. The
  // parsed body (or undefined) rides along on the AgentApiError.
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

  // Send a request and parse a success body through `schema`. A schema violation
  // throws zod's error unchanged (the anti-drift behavior, not caught here).
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

  // Multipart upload: the file rides under field 'image'. No Content-Type header is
  // set manually so the browser writes the multipart boundary.
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
    cancelMessage,
    getDraft,
    uploadImage
  }
}

export type AgentRestClient = ReturnType<typeof createAgentRestClient>
