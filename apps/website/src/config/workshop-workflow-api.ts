import { z } from 'astro/zod'
import { zJobCancelResponse, zPromptResponse } from '@comfyorg/ingest-types/zod'
import type { PromptRequest } from '@comfyorg/ingest-types'

import { combineAbortSignals, createTimeoutSignal } from '@/utils/abortSignal'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import type { WorkshopWorkflowDefinition } from './workshop-workflow-definition'
import type { FieldErrors } from './workshop-playground'
import {
  WORKFLOW_CONTROL_BYTES,
  cloudWorkflowResult,
  workflowRunIdSchema
} from './workshop-workflow-response'
import type {
  WorkflowErrorCode,
  WorkflowRunRequest,
  WorkflowRunSummary
} from './workshop-workflow-response'

export type WorkflowUploadStage =
  | 'download'
  | 'mint'
  | 'upload'
  | 'timeout'
  | 'network'

interface WorkshopWorkflowErrorOptions extends ErrorOptions {
  readonly stage?: WorkflowUploadStage
}

export class WorkshopWorkflowError extends Error {
  readonly stage?: WorkflowUploadStage

  constructor(
    readonly code: WorkflowErrorCode | 'network' | 'response' | 'persistence',
    readonly fieldErrors: FieldErrors = {},
    readonly status?: number,
    options?: WorkshopWorkflowErrorOptions
  ) {
    super('Workflow request failed: ' + code, options)
    this.stage = options?.stage
  }
}

export interface WorkflowApiOptions {
  readonly token: string | ((refresh?: boolean) => Promise<string>)
  readonly authentication?: 'session' | 'api-key'
  readonly fetch?: typeof fetch
}

export async function workflowResponseJson(
  response: Response
): Promise<unknown> {
  const reader = response.body?.getReader()
  if (!reader) throw new WorkshopWorkflowError('response')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    if (Number(response.headers.get('Content-Length')) > WORKFLOW_CONTROL_BYTES)
      throw new WorkshopWorkflowError('response')
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > WORKFLOW_CONTROL_BYTES)
        throw new WorkshopWorkflowError('response')
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    await reader.cancel().catch(() => {})
    throw new WorkshopWorkflowError('response')
  } finally {
    reader.releaseLock()
  }
}

export function workflowCloudRequest(
  definition: WorkshopWorkflowDefinition,
  request: WorkflowRunRequest
): PromptRequest {
  if (
    !definition.cloud ||
    request.workflowId !== definition.id ||
    request.definitionVersion !== definition.definitionVersion
  )
    throw new WorkshopWorkflowError('definition_incompatible')
  const prompt = structuredClone(definition.cloud.workflow)
  for (const [name, value] of Object.entries(request.appInputs)) {
    if (!Object.hasOwn(definition.cloud.inputBindings, name))
      throw new WorkshopWorkflowError('invalid_input', { [name]: 'rejected' })
    const binding = definition.cloud.inputBindings[name]
    for (const target of binding.targets) {
      const node = prompt[target.nodeId]
      if (
        !Object.hasOwn(prompt, target.nodeId) ||
        !Object.hasOwn(node.inputs, target.inputName)
      )
        throw new WorkshopWorkflowError('definition_incompatible')
      node.inputs[target.inputName] = value
    }
  }
  return { prompt }
}

export function withPartnerNodeCredential(
  request: PromptRequest,
  authentication: WorkflowApiOptions['authentication'],
  token: string
): PromptRequest {
  return {
    ...request,
    extra_data: {
      ...request.extra_data,
      ...(authentication === 'api-key'
        ? { api_key_comfy_org: token }
        : { auth_token_comfy_org: token })
    }
  }
}

function responseError(status: number): WorkshopWorkflowError {
  const codes: Record<number, WorkflowErrorCode> = {
    400: 'invalid_input',
    401: 'not_authenticated',
    402: 'insufficient_credits',
    403: 'access_denied',
    404: 'run_not_found',
    413: 'payload_too_large',
    415: 'unsupported_media_type',
    422: 'invalid_input',
    429: 'rate_limited'
  }
  return new WorkshopWorkflowError(
    codes[status] ??
      (status >= 500 ? 'service_unavailable' : 'invalid_request'),
    {},
    status
  )
}

type WorkflowResponseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false }
}

const cloudErrorSchema = z.object({
  error: z.object({ type: z.string() })
})

const CREDIT_REFUSAL_TYPES = new Set([
  'PAYMENT_REQUIRED',
  'FREE_TIER_UNAVAILABLE',
  'FREE_TIER_EXHAUSTED',
  'PARTNER_NODE_PAYMENT_REQUIRED'
])

async function cloudErrorType(response: Response): Promise<string | undefined> {
  try {
    const parsed = cloudErrorSchema.safeParse(
      await workflowResponseJson(response)
    )
    return parsed.success ? parsed.data.error.type : undefined
  } catch {
    return undefined
  }
}

async function failedResponseError(
  response: Response
): Promise<WorkshopWorkflowError> {
  const errorType = await cloudErrorType(response)
  if (errorType && CREDIT_REFUSAL_TYPES.has(errorType))
    return new WorkshopWorkflowError(
      'insufficient_credits',
      {},
      response.status
    )
  return responseError(response.status)
}

async function parseResponse<T>(
  response: Response,
  schema: WorkflowResponseSchema<T>
): Promise<T> {
  if (!response.ok) throw await failedResponseError(response)
  const parsed = schema.safeParse(await workflowResponseJson(response))
  if (!parsed.success) throw new WorkshopWorkflowError('response')
  return parsed.data
}

export function createWorkflowApi(
  options: WorkflowApiOptions & {
    readonly definition: WorkshopWorkflowDefinition
  }
) {
  const transport = options.fetch ?? globalThis.fetch

  async function send(
    url: URL,
    init: {
      readonly method: string
      readonly signal: AbortSignal
      readonly encode: (token: string) => string | undefined
    },
    refresh = false,
    beforeSend?: () => void | Promise<void>
  ) {
    init.signal.throwIfAborted()
    const token =
      typeof options.token === 'function'
        ? await options.token(refresh)
        : options.token
    init.signal.throwIfAborted()
    if (!token) throw new WorkshopWorkflowError('not_authenticated')
    const body = init.encode(token)
    await beforeSend?.()
    init.signal.throwIfAborted()
    return transport(url, {
      method: init.method,
      body,
      signal: init.signal,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      headers: {
        ...(options.authentication === 'api-key'
          ? { 'X-API-Key': token }
          : { Authorization: 'Bearer ' + token }),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      }
    })
  }

  async function request<T>(
    path: string,
    schema: WorkflowResponseSchema<T>,
    signal: AbortSignal,
    method = 'GET',
    body?: unknown | ((token: string) => unknown),
    beforeSend?: () => void | Promise<void>
  ): Promise<T> {
    signal.throwIfAborted()
    const url = new URL(path, WORKSHOP_CLOUD_BASE_URL)
    if (!path.startsWith('/api/') || url.origin !== WORKSHOP_CLOUD_BASE_URL)
      throw new WorkshopWorkflowError('invalid_request')
    const encode = (token: string) => {
      const encoded: string | undefined = JSON.stringify(
        typeof body === 'function' ? body(token) : body
      )
      if (
        encoded &&
        new TextEncoder().encode(encoded).byteLength > WORKFLOW_CONTROL_BYTES
      )
        throw new WorkshopWorkflowError('payload_too_large')
      return encoded
    }
    const requestSignal = combineAbortSignals([
      signal,
      createTimeoutSignal(45_000)
    ])
    try {
      const init = { method, encode, signal: requestSignal }
      let response = await send(url, init, false, beforeSend)
      if (response.status === 401 && typeof options.token === 'function') {
        await response.body?.cancel()
        response = await send(url, init, true)
      }
      const result = await parseResponse(response, schema)
      signal.throwIfAborted()
      return result
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof WorkshopWorkflowError) throw error
      throw new WorkshopWorkflowError('network', {}, undefined, {
        cause: error
      })
    }
  }

  async function read(id: string, signal: AbortSignal) {
    const job = await request(
      '/api/jobs/' +
        workflowRunIdSchema.parse(id) +
        '?short_link=ephemeral_tool_chain',
      z.unknown(),
      signal
    )
    try {
      return cloudWorkflowResult(job, options.definition, id)
    } catch {
      throw new WorkshopWorkflowError('response')
    }
  }

  return {
    request,
    async submit(
      body: WorkflowRunRequest,
      signal: AbortSignal,
      beforeSend?: () => void | Promise<void>
    ): Promise<WorkflowRunSummary> {
      const result = await request(
        '/api/prompt',
        zPromptResponse,
        signal,
        'POST',
        (token: string) =>
          withPartnerNodeCredential(
            workflowCloudRequest(options.definition, body),
            options.authentication,
            token
          ),
        beforeSend
      )
      if (!result.prompt_id) throw new WorkshopWorkflowError('response')
      const now = new Date().toISOString()
      return {
        id: result.prompt_id,
        workflowId: body.workflowId,
        definitionVersion: body.definitionVersion,
        state: 'queued',
        outputState: 'pending',
        createdAt: now,
        updatedAt: now
      }
    },
    read,
    async cancel(id: string, signal: AbortSignal) {
      await request(
        '/api/jobs/' + workflowRunIdSchema.parse(id) + '/cancel',
        zJobCancelResponse,
        signal,
        'POST'
      )
      return read(id, signal)
    },
    retryDelivery: read,
    async access(id: string, outputId: string, signal: AbortSignal) {
      const result = await read(id, signal)
      const output = result.outputs.find((item) => item.id === outputId)
      if (output?.delivery.state !== 'ready')
        throw new WorkshopWorkflowError('delivery_failed')
      return output.delivery.access
    }
  }
}

export type WorkflowApi = ReturnType<typeof createWorkflowApi>
