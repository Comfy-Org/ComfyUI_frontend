import type { z } from 'astro/zod'

import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'
import type { FieldErrors } from './workshop-playground'
import {
  WORKFLOW_CONTROL_BYTES,
  workflowAccessSchema,
  workflowErrorSchema,
  workflowHistorySchema,
  workflowIdSchema,
  workflowRunPath,
  workflowRunIdSchema,
  workflowRunSchema,
  workflowRuntimeSchema,
  workflowSummarySchema
} from './workshop-workflow-response'
import type {
  WorkflowErrorCode,
  WorkflowRunRequest
} from './workshop-workflow-response'

export class WorkshopWorkflowError extends Error {
  constructor(
    readonly code: WorkflowErrorCode | 'network' | 'response' | 'persistence',
    readonly fieldErrors: FieldErrors = {},
    readonly status?: number
  ) {
    super(`Workflow request failed: ${code}`)
  }
}

export interface WorkflowApiOptions {
  readonly token: string | ((refresh?: boolean) => Promise<string>)
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

function workflowRequestUrl(path: string): URL {
  const base = new URL(WORKSHOP_ROUTER_BASE_URL)
  const url = new URL(path, base)
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    url.origin !== base.origin
  )
    throw new WorkshopWorkflowError('invalid_request')
  return url
}

function workflowRequestBody(body: unknown): string | undefined {
  const encoded = body === undefined ? undefined : JSON.stringify(body)
  if (
    encoded !== undefined &&
    new TextEncoder().encode(encoded).byteLength > WORKFLOW_CONTROL_BYTES
  )
    throw new WorkshopWorkflowError('payload_too_large')
  return encoded
}

async function parseWorkflowResponse<T>(
  response: Response,
  schema: z.ZodType<T>
): Promise<T> {
  const body = await workflowResponseJson(response)
  if (!response.ok) {
    const parsed = workflowErrorSchema.safeParse(body)
    if (!parsed.success)
      throw new WorkshopWorkflowError('response', {}, response.status)
    const { code, fieldId } = parsed.data.error
    throw new WorkshopWorkflowError(
      code,
      fieldId ? { [fieldId]: 'rejected' } : {},
      response.status
    )
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new WorkshopWorkflowError('response')
  return parsed.data
}

export function createWorkflowApi(options: WorkflowApiOptions) {
  const transport = options.fetch ?? globalThis.fetch

  async function authenticatedRequest(
    url: URL,
    init: RequestInit,
    signal: AbortSignal
  ): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt++) {
      signal.throwIfAborted()
      const token =
        typeof options.token === 'function'
          ? await options.token(attempt > 0)
          : options.token
      signal.throwIfAborted()
      if (!token) throw new WorkshopWorkflowError('not_authenticated')
      const headers = new Headers(init.headers)
      headers.set('Authorization', `Bearer ${token}`)
      const response = await transport(url, { ...init, headers })
      if (
        response.status === 401 &&
        attempt === 0 &&
        typeof options.token === 'function'
      ) {
        await response.body?.cancel()
        continue
      }
      return response
    }
    throw new WorkshopWorkflowError('not_authenticated')
  }

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    method = 'GET',
    body?: unknown,
    idempotencyKey?: string
  ): Promise<T> {
    const url = workflowRequestUrl(path)
    const encoded = workflowRequestBody(body)
    const deadline = new AbortController()
    const abort = () => deadline.abort(signal.reason)
    const timer = setTimeout(() => deadline.abort(), 45_000)
    signal.addEventListener('abort', abort, { once: true })
    try {
      const response = await authenticatedRequest(
        url,
        {
          method,
          body: encoded,
          signal: deadline.signal,
          credentials: 'omit',
          redirect: 'error',
          cache: 'no-store',
          headers: {
            ...(encoded === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
          }
        },
        signal
      )
      const result = await parseWorkflowResponse(response, schema)
      signal.throwIfAborted()
      return result
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof WorkshopWorkflowError) throw error
      throw new WorkshopWorkflowError('network')
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
    }
  }

  return {
    request,
    async submit(body: WorkflowRunRequest, key: string, signal: AbortSignal) {
      if (!/^[\x21-\x7e]{1,128}$/.test(key))
        throw new WorkshopWorkflowError('invalid_request')
      const run = await request(
        '/v1/workshop/workflow-runs',
        workflowSummarySchema,
        signal,
        'POST',
        body,
        key
      )
      if (
        run.workflowId !== body.workflowId ||
        run.definitionVersion !== body.definitionVersion
      )
        throw new WorkshopWorkflowError('response')
      return run
    },
    async read(id: string, signal: AbortSignal) {
      const result = await request(
        workflowRunPath(id),
        workflowRunSchema,
        signal
      )
      if (result.run.id !== id) throw new WorkshopWorkflowError('response')
      return result
    },
    async cancel(id: string, signal: AbortSignal) {
      const result = await request(
        `${workflowRunPath(id)}/cancel`,
        workflowRunSchema,
        signal,
        'POST'
      )
      if (result.run.id !== id) throw new WorkshopWorkflowError('response')
      return result
    },
    async retryDelivery(id: string, signal: AbortSignal) {
      const result = await request(
        `${workflowRunPath(id)}/outputs/retry`,
        workflowRunSchema,
        signal,
        'POST'
      )
      if (result.run.id !== id) throw new WorkshopWorkflowError('response')
      return result
    },
    async access(id: string, outputId: string, signal: AbortSignal) {
      const output = workflowRunIdSchema.parse(outputId)
      const path = `${workflowRunPath(id)}/outputs/${output}/access`
      const access = await request(path, workflowAccessSchema, signal)
      if (
        access.refreshUrl !== path ||
        Date.parse(access.expiresAt) <= Date.now()
      )
        throw new WorkshopWorkflowError('response')
      return access
    },
    history(signal: AbortSignal, workflowId?: string, cursor?: string) {
      const query = new URLSearchParams({ limit: '20' })
      if (workflowId)
        query.set('workflowId', workflowIdSchema.parse(workflowId))
      if (cursor) query.set('cursor', cursor)
      return request(
        `/v1/workshop/workflow-runs?${query}`,
        workflowHistorySchema,
        signal
      )
    },
    runtime(workflowId: string, signal: AbortSignal) {
      return request(
        `/v1/workshop/workflows/${encodeURIComponent(workflowIdSchema.parse(workflowId))}/runtime`,
        workflowRuntimeSchema,
        signal
      )
    }
  }
}

export type WorkflowApi = ReturnType<typeof createWorkflowApi>
