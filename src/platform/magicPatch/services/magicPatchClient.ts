import type { CreateRequest, RequestStatus } from '@comfyorg/magic-patch-types'
import {
  zCancellationStatus,
  zCreateRequest,
  zDigest,
  zRequestPage,
  zRequestStatus
} from '@comfyorg/magic-patch-types/zod'
import type { ZodType } from 'zod'
import { ZodError } from 'zod'

import { reportError } from '@/platform/telemetry/reportError'

type FailureCode =
  | 'unavailable'
  | 'scope_changed'
  | 'invalid_request'
  | 'invalid_response'
  | 'request_failed'
  | 'transport_indeterminate'
  | 'report_mismatch'
type MagicPatchResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: FailureCode; status?: number } }

class MagicPatchProtocolError extends Error {
  constructor(readonly code: FailureCode) {
    super(code)
    this.name = 'MagicPatchProtocolError'
  }
}
class MagicPatchRequestError extends Error {
  constructor(readonly status: number) {
    super(`Magic Patch request failed (${status})`)
    this.name = 'MagicPatchRequestError'
  }
}

export function createMagicPatchClient<Scope>(
  fetchApi: (route: string, options: RequestInit) => Promise<Response>,
  available: () => boolean,
  scopeGuard: { capture: () => Scope; current: (captured: Scope) => boolean }
) {
  async function request(route: string, options: RequestInit) {
    if (!available()) throw new MagicPatchRequestError(503)
    const captured = scopeGuard.capture()
    if (!scopeGuard.current(captured))
      throw new MagicPatchProtocolError('scope_changed')
    const response = await fetchApi(`/magic-patch${route}`, options)
    if (!response.ok) throw new MagicPatchRequestError(response.status)
    return { response, current: () => scopeGuard.current(captured) }
  }

  function finish<T>(call: { current: () => boolean }, value: T): T {
    if (!call.current()) throw new MagicPatchProtocolError('scope_changed')
    if (!available()) throw new MagicPatchRequestError(503)
    return value
  }

  function validateInput<T>(schema: ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input)
    if (!result.success) throw new MagicPatchProtocolError('invalid_request')
    return result.data
  }
  function requestPath(id: RequestStatus['id']) {
    validateInput(zRequestStatus.pick({ id: true }), { id })
    return `/requests/${id}`
  }

  async function submit(
    input: CreateRequest,
    idempotencyKey: string,
    signal?: AbortSignal
  ) {
    const body = validateInput(zCreateRequest, input)
    if (!idempotencyKey || idempotencyKey.length > 200) {
      throw new MagicPatchProtocolError('invalid_request')
    }
    const response = await request('/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(body),
      signal
    })
    return finish(
      response,
      zRequestStatus.parse(await response.response.json())
    )
  }

  async function list(after?: string, signal?: AbortSignal) {
    if (after !== undefined && (!after || after.length > 1024)) {
      throw new MagicPatchProtocolError('invalid_request')
    }
    const parameters = new URLSearchParams({ limit: '50' })
    if (after) parameters.set('after', after)
    const response = await request(`/requests?${parameters}`, {
      method: 'GET',
      signal
    })
    return finish(response, zRequestPage.parse(await response.response.json()))
  }

  async function status(id: RequestStatus['id'], signal?: AbortSignal) {
    const response = await request(requestPath(id), { method: 'GET', signal })
    const value = zRequestStatus.parse(await response.response.json())
    if (value.id !== id) throw new MagicPatchProtocolError('invalid_response')
    return finish(response, value)
  }

  async function cancel(id: RequestStatus['id'], signal?: AbortSignal) {
    const response = await request(`${requestPath(id)}/cancel`, {
      method: 'POST',
      signal
    })
    const value = zCancellationStatus.parse(await response.response.json())
    if (value.request.id !== id)
      throw new MagicPatchProtocolError('invalid_response')
    return finish(response, value)
  }

  async function report(
    id: RequestStatus['id'],
    expectedDigest: string,
    signal?: AbortSignal
  ): Promise<unknown> {
    validateInput(zDigest, expectedDigest)
    const response = await request(`${requestPath(id)}/report`, {
      method: 'GET',
      signal
    })
    if (response.response.headers.get('X-Content-SHA256') !== expectedDigest) {
      throw new MagicPatchProtocolError('report_mismatch')
    }
    const bytes = await response.response.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const actual = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, '0')
    ).join('')
    if (actual !== expectedDigest)
      throw new MagicPatchProtocolError('report_mismatch')
    const value: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    )
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new MagicPatchProtocolError('invalid_response')
    }
    return finish(response, value)
  }

  async function recover<T>(
    command: () => Promise<T>
  ): Promise<MagicPatchResult<T>> {
    try {
      return { ok: true, value: await command() }
    } catch (cause) {
      const code =
        cause instanceof MagicPatchProtocolError
          ? cause.code
          : cause instanceof MagicPatchRequestError
            ? cause.status === 503
              ? 'unavailable'
              : 'request_failed'
            : cause instanceof ZodError || cause instanceof SyntaxError
              ? 'invalid_response'
              : 'transport_indeterminate'
      if (code !== 'scope_changed' && code !== 'unavailable') {
        reportError(new MagicPatchProtocolError(code), {
          errorType: 'magic_patch_request_failure'
        })
      }
      return {
        ok: false,
        error: {
          code,
          ...(cause instanceof MagicPatchRequestError
            ? { status: cause.status }
            : {})
        }
      }
    }
  }

  return {
    submit: (...args: Parameters<typeof submit>) =>
      recover(() => submit(...args)),
    list: (...args: Parameters<typeof list>) => recover(() => list(...args)),
    status: (...args: Parameters<typeof status>) =>
      recover(() => status(...args)),
    cancel: (...args: Parameters<typeof cancel>) =>
      recover(() => cancel(...args)),
    report: (...args: Parameters<typeof report>) =>
      recover(() => report(...args))
  }
}
