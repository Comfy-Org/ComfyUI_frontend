import type {
  CreateRequest,
  PackSourceRequest,
  RequestStatus,
  WorkflowSourceRequest
} from '@comfyorg/magic-patch-types'
import {
  zCancellationStatus,
  zAPIError,
  zCreateRequest,
  zDigest,
  zPackSourceRequest,
  zPackSourceResponse,
  zRequestPage,
  zRequestStatus,
  zSourceAcquisition,
  zSourceEligibility,
  zWorkflowSourceDiscovery,
  zWorkflowSourceRequest
} from '@comfyorg/magic-patch-types/zod'
import type { ZodType } from 'zod'
import { ZodError } from 'zod'

import { reportError } from '@/platform/telemetry/reportError'
import { magicPatchResponseLimits } from './magicPatchResponseLimits'

type FailureCode =
  | 'unavailable'
  | 'scope_changed'
  | 'invalid_request'
  | 'invalid_response'
  | 'request_failed'
  | 'transport_indeterminate'
  | 'report_mismatch'
  | 'response_too_large'
  | 'response_too_fragmented'
  | 'response_timeout'
export type MagicPatchFailure = {
  code: FailureCode
  status?: number
  reason?: string
}
type MagicPatchResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      error: MagicPatchFailure
    }

class MagicPatchProtocolError extends Error {
  constructor(readonly code: FailureCode) {
    super(code)
    this.name = 'MagicPatchProtocolError'
  }
}
class MagicPatchRequestError extends Error {
  constructor(
    readonly status: number,
    readonly reason?: string,
    readonly code?: FailureCode
  ) {
    super(`Magic Patch request failed (${status})`)
    this.name = 'MagicPatchRequestError'
  }
}

export function createMagicPatchClient<Scope>(
  fetchApi: (
    route: string,
    options: RequestInit,
    beforeDispatch: () => void
  ) => Promise<Response>,
  available: () => boolean,
  scopeGuard: { capture: () => Scope; current: (captured: Scope) => boolean }
) {
  async function request(
    route: string,
    options: RequestInit,
    beforeDispatch?: () => void,
    acceptedStatus: number[] = []
  ) {
    if (!available()) throw new MagicPatchRequestError(503)
    const captured = scopeGuard.capture()
    const check = () => {
      if (!scopeGuard.current(captured))
        throw new MagicPatchProtocolError('scope_changed')
      if (!available()) throw new MagicPatchRequestError(503)
      options.signal?.throwIfAborted()
      beforeDispatch?.()
    }
    check()
    const response = await fetchApi(`/magic-patch${route}`, options, check)
    const call = {
      response,
      current: () => scopeGuard.current(captured),
      check,
      signal: options.signal
    }
    try {
      check()
      if (!response.ok && !acceptedStatus.includes(response.status)) {
        let reason: string | undefined
        let code: FailureCode | undefined
        try {
          const failure = zAPIError.safeParse(await readJSON(call))
          if (failure.success && /^[a-z_]{1,80}$/u.test(failure.data.code))
            reason = failure.data.code
        } catch (cause) {
          check()
          if (
            cause instanceof MagicPatchProtocolError &&
            cause.code === 'scope_changed'
          )
            throw cause
          code =
            cause instanceof MagicPatchProtocolError
              ? cause.code
              : cause instanceof SyntaxError || cause instanceof TypeError
                ? 'invalid_response'
                : 'transport_indeterminate'
        }
        throw new MagicPatchRequestError(response.status, reason, code)
      }
    } catch (cause) {
      void response.body?.cancel().catch(() => {})
      throw cause
    }
    return call
  }

  async function readBytes(
    call: {
      response: Response
      check: () => void
      signal: RequestInit['signal']
    },
    maximum: number
  ): Promise<Uint8Array<ArrayBuffer>> {
    const reader = call.response.body?.getReader()
    const deadline =
      performance.now() + magicPatchResponseLimits.bodyMilliseconds
    const chunks: Uint8Array[] = []
    let length = 0
    let interruption: { cause: unknown } | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let onAbort: (() => void) | undefined
    const checkRead = () => {
      if (interruption) throw interruption.cause
      call.check()
      const now = performance.now()
      if (
        !Number.isFinite(deadline) ||
        !Number.isFinite(now) ||
        now >= deadline
      )
        throw new MagicPatchProtocolError('response_timeout')
    }
    const consume = async () => {
      checkRead()
      const declared = call.response.headers.get('Content-Length')
      if (
        declared !== null &&
        /^\d+$/.test(declared) &&
        Number(declared) > maximum
      )
        throw new MagicPatchProtocolError('response_too_large')
      if (reader) {
        let reads = 0
        while (true) {
          checkRead()
          if (++reads > magicPatchResponseLimits.streamReads)
            throw new MagicPatchProtocolError('response_too_fragmented')
          const { done, value } = await reader.read()
          checkRead()
          if (done) break
          if (value.byteLength > maximum - length)
            throw new MagicPatchProtocolError('response_too_large')
          length += value.byteLength
          if (value.byteLength) chunks.push(value)
        }
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      checkRead()
      return bytes
    }
    try {
      call.check()
      const interrupted = new Promise<never>((_, reject) => {
        const stop = (cause: unknown) => {
          if (interruption) return
          interruption = { cause }
          reject(cause)
          void reader?.cancel().catch(() => {})
        }
        timer = setTimeout(
          () => stop(new MagicPatchProtocolError('response_timeout')),
          magicPatchResponseLimits.bodyMilliseconds
        )
        onAbort = () => {
          try {
            call.check()
          } catch (cause) {
            stop(cause)
            return
          }
          stop(new MagicPatchProtocolError('transport_indeterminate'))
        }
        call.signal?.addEventListener('abort', onAbort, { once: true })
      })
      return await Promise.race([consume(), interrupted])
    } catch (cause) {
      void reader?.cancel().catch(() => {})
      throw cause
    } finally {
      if (timer !== undefined) clearTimeout(timer)
      if (onAbort) call.signal?.removeEventListener('abort', onAbort)
      reader?.releaseLock()
    }
  }

  async function readJSON(
    call: Parameters<typeof readBytes>[0]
  ): Promise<unknown> {
    const bytes = await readBytes(call, magicPatchResponseLimits.jsonBytes)
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
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
    return finish(response, zRequestStatus.parse(await readJSON(response)))
  }

  async function source(input: PackSourceRequest, signal?: AbortSignal) {
    const body = validateInput(zPackSourceRequest, input)
    const response = await request(
      '/sources/pack',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      },
      undefined,
      [422]
    )
    if (!response.response.ok) {
      const failure = zAPIError.parse(await readJSON(response))
      if (!/^[a-z_]{1,80}$/u.test(failure.code))
        throw new MagicPatchProtocolError('invalid_response')
      throw new MagicPatchRequestError(response.response.status, failure.code)
    }
    const value = zPackSourceResponse.parse(await readJSON(response))
    if (
      value.pack_id !== body.pack_id ||
      value.revision_id !== body.revision_id
    )
      throw new MagicPatchProtocolError('invalid_response')
    return finish(response, value)
  }

  async function prepareSource(input: PackSourceRequest, signal?: AbortSignal) {
    const body = validateInput(zPackSourceRequest, input)
    const response = await request('/sources/registry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    })
    const value = zSourceAcquisition.parse(await readJSON(response))
    if (
      value.source &&
      (value.source.pack_id !== body.pack_id ||
        ![value.source.revision_id, value.source.registry_revision_id].includes(
          body.revision_id
        ))
    )
      throw new MagicPatchProtocolError('invalid_response')
    return finish(response, value)
  }

  async function sourceStatus(id: string, signal?: AbortSignal) {
    if (!/^[a-f0-9]{32}$/u.test(id))
      throw new MagicPatchProtocolError('invalid_request')
    const response = await request(`/source-acquisitions/${id}`, {
      method: 'GET',
      signal
    })
    const value = zSourceAcquisition.parse(await readJSON(response))
    if (value.acquisition_id !== id)
      throw new MagicPatchProtocolError('invalid_response')
    return finish(response, value)
  }

  async function prepareWorkflowSource(
    input: WorkflowSourceRequest,
    signal?: AbortSignal
  ) {
    const body = validateInput(zWorkflowSourceRequest, input)
    const response = await request(
      '/sources/workflow',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      },
      undefined,
      [422]
    )
    if (!response.response.ok) {
      const failure = zAPIError.parse(await readJSON(response))
      if (!/^[a-z_]{1,80}$/u.test(failure.code))
        throw new MagicPatchProtocolError('invalid_response')
      throw new MagicPatchRequestError(response.response.status, failure.code)
    }
    const accepted = finish(
      response,
      zSourceAcquisition.parse(await readJSON(response))
    )
    const lookup = await request(
      `/workflow-source-discoveries/${accepted.acquisition_id}`,
      { method: 'GET', signal }
    )
    const discovery = zWorkflowSourceDiscovery.parse(await readJSON(lookup))
    const expected = {
      ...body,
      ...(body.aux_id
        ? {
            aux_id: (body.aux_id.startsWith('https://')
              ? body.aux_id
              : `https://github.com/${body.aux_id}`
            )
              .replace(/\/$/u, '')
              .replace(/\.git$/u, '')
          }
        : {})
    }
    const selected = discovery.workflow_selector
    if (
      discovery.acquisition.acquisition_id !== accepted.acquisition_id ||
      discovery.acquisition.status_version < accepted.status_version ||
      selected.cnr_id !== expected.cnr_id ||
      selected.aux_id !== expected.aux_id ||
      selected.ver !== expected.ver ||
      JSON.stringify(selected.node_types) !==
        JSON.stringify(expected.node_types)
    )
      throw new MagicPatchProtocolError('invalid_response')
    return finish(lookup, discovery.acquisition)
  }

  async function eligibility(
    input: PackSourceRequest,
    workflowVersion: string,
    nodeType: string,
    signal?: AbortSignal
  ) {
    const selector = validateInput(zPackSourceRequest, input)
    if (
      !workflowVersion ||
      workflowVersion.length > 128 ||
      !nodeType ||
      nodeType.length > 256
    )
      throw new MagicPatchProtocolError('invalid_request')
    const query = new URLSearchParams({
      ...selector,
      workflow_version: workflowVersion,
      node_type: nodeType
    })
    const response = await request(`/eligible-packs?${query}`, {
      method: 'GET',
      signal
    })
    const value = zSourceEligibility.parse(await readJSON(response))
    if (
      value.candidates.some(
        (candidate) =>
          candidate.pack_id !== selector.pack_id ||
          ![candidate.revision_id, candidate.registry_revision_id].includes(
            selector.revision_id
          )
      )
    )
      throw new MagicPatchProtocolError('invalid_response')
    return finish(response, value)
  }

  async function list(
    after?: string,
    signal?: AbortSignal,
    beforeDispatch?: () => void
  ) {
    if (after !== undefined && (!after || after.length > 1024)) {
      throw new MagicPatchProtocolError('invalid_request')
    }
    const parameters = new URLSearchParams({ limit: '50' })
    if (after) parameters.set('after', after)
    const response = await request(
      `/requests?${parameters}`,
      { method: 'GET', signal },
      beforeDispatch
    )
    return finish(response, zRequestPage.parse(await readJSON(response)))
  }

  async function status(id: RequestStatus['id'], signal?: AbortSignal) {
    const response = await request(requestPath(id), { method: 'GET', signal })
    const value = zRequestStatus.parse(await readJSON(response))
    if (value.id !== id) throw new MagicPatchProtocolError('invalid_response')
    return finish(response, value)
  }

  async function cancel(id: RequestStatus['id'], signal?: AbortSignal) {
    const response = await request(`${requestPath(id)}/cancel`, {
      method: 'POST',
      signal
    })
    const value = zCancellationStatus.parse(await readJSON(response))
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
      void response.response.body?.cancel().catch(() => {})
      throw new MagicPatchProtocolError('report_mismatch')
    }
    const bytes = await readBytes(
      response,
      magicPatchResponseLimits.reportBytes
    )
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
            ? (cause.code ??
              (cause.status === 503 ? 'unavailable' : 'request_failed'))
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
            ? {
                status: cause.status,
                ...(cause.reason ? { reason: cause.reason } : {})
              }
            : {})
        }
      }
    }
  }

  return {
    source: (...args: Parameters<typeof source>) =>
      recover(() => source(...args)),
    prepareSource: (...args: Parameters<typeof prepareSource>) =>
      recover(() => prepareSource(...args)),
    prepareWorkflowSource: (
      ...args: Parameters<typeof prepareWorkflowSource>
    ) => recover(() => prepareWorkflowSource(...args)),
    sourceStatus: (...args: Parameters<typeof sourceStatus>) =>
      recover(() => sourceStatus(...args)),
    eligibility: (...args: Parameters<typeof eligibility>) =>
      recover(() => eligibility(...args)),
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
