import type { z } from 'zod'

import { api } from '@/scripts/api'

import {
  zAgentCancelAccepted,
  zAgentDraftSnapshot,
  zAgentError,
  zAgentMessages,
  zAgentThreads,
  zAgentTurnAccepted,
  zUploadImageResult
} from '../../schemas/agentApiSchema'
import type {
  AgentCancelAccepted,
  AgentDraftSnapshot,
  AgentMessages,
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

// The client's canvas, uploaded with a turn so the server seeds the thread's
// draft from it before the agent runs. content is the SAVE format
// (app.graph.serialize()), not the API/prompt format. version null
// force-seeds; a non-null value is the draft version the client last
// received - the server 409s {error, version} when its draft has moved past
// it, and the client retries once against the returned version.
export interface DraftUpload {
  content: unknown
  version: number | null
}

export interface PostMessageInput {
  content: string
  workflowId?: string
  selection?: Record<string, unknown>
  attachments?: string[]
  draft?: DraftUpload
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

  // Rides api.fetchApi so agent calls share the host transport: auth headers
  // (Firebase/workspace), the 401 remint retry, and the Comfy-User header.
  // A schema violation throws zod's error uncaught here, by design (anti-drift seam).
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

  // threadId 'new' opens a thread as part of posting the first message.
  async function postMessage(
    threadId: string,
    req: PostMessageInput
  ): Promise<AgentTurnAccepted> {
    const body: Record<string, unknown> = { content: req.content }
    if (req.workflowId !== undefined) body.workflow_id = req.workflowId
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

  // No Content-Type header is set so the browser writes the multipart boundary itself.
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
    cancelMessage,
    getDraft,
    uploadImage
  }
}

export type AgentRestClient = ReturnType<typeof createAgentRestClient>
