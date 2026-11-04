import { combineAbortSignals } from '@comfyorg/api-client/abortSignal'
import type { AuthHeader } from '@comfyorg/api-client/authTypes'
import {
  NO_RETRY_POLICY,
  parseRetryAfterMs
} from '@comfyorg/api-client/retryPolicy'
import { compact } from 'es-toolkit'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import {
  fetchWithUnifiedRemint,
  shouldRemintCloudRequest
} from '@/platform/auth/unified/remintRetry'
import {
  arrayAt,
  stringAt,
  valueAt
} from '@/renderer/extensions/superComfy/router/routerJson'
import { useAuthStore } from '@/stores/authStore'

export interface RouterHeaders {
  retryAfterMs?: number
  creditsUsed?: number
  errorType?: string
  requestId?: string
  replayed: boolean
  droppedParams?: string
  estimatedSeconds?: number
}

export interface RouterRequest {
  path: string
  method: 'GET' | 'POST'
  body?: unknown
  idempotencyKey?: string
  signal?: AbortSignal
  timeoutMs: number
}

export type RouterResponse =
  | {
      ok: true
      status: number
      headers: RouterHeaders
      json?: unknown
      blob?: Blob
      contentType: string
    }
  | {
      ok: false
      reason: 'refused'
      status: number
      errorType?: string
      detail: string
      headers: RouterHeaders
    }
  | { ok: false; reason: 'unauthenticated'; detail: string }
  | { ok: false; reason: 'network'; message: string }

export type RouterFailure = Exclude<RouterResponse, { ok: true }>

export interface RouterClient {
  fetch(request: RouterRequest): Promise<RouterResponse>
}

type CredentialKind = 'workspace' | 'firebase'

interface ReadBody {
  json?: unknown
  blob?: Blob
  text?: string
  contentType: string
}

const MAX_RETRY_AFTER_MS = 60_000

export function routerModelPath(modelId: string): string {
  const [provider, ...rest] = modelId.split('/')
  return `${encodeURIComponent(provider)}/${encodeURIComponent(rest.join('/'))}`
}

function routerUrl(path: string): string {
  return `${getComfyApiBaseUrl()}${path}`
}

function numberHeader(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name)?.trim()
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

export function parseRouterHeaders(
  headers: Headers,
  now: number
): RouterHeaders {
  const retryAfter = parseRetryAfterMs(headers.get('Retry-After'), now)
  return {
    retryAfterMs:
      retryAfter === undefined
        ? undefined
        : Math.min(retryAfter, MAX_RETRY_AFTER_MS),
    creditsUsed: numberHeader(headers, 'X-Comfy-Credits-Used'),
    errorType: headers.get('X-Comfy-Error-Type') || undefined,
    requestId: headers.get('X-Comfy-Request-Id') || undefined,
    replayed: headers.get('Idempotent-Replayed') === 'true',
    droppedParams: headers.get('X-Comfy-Router-Dropped-Params') || undefined,
    estimatedSeconds: numberHeader(
      headers,
      'X-Comfy-Estimated-Duration-Seconds'
    )
  }
}

async function readBody(response: Response): Promise<ReadBody> {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (/json/i.test(contentType)) {
    const json: unknown = await response.json().catch(() => undefined)
    return { json, contentType }
  }
  if (response.ok) return { blob: await response.blob(), contentType }
  return { text: await response.text().catch(() => ''), contentType }
}

function validationMessage(entry: unknown): string {
  const location = arrayAt(entry, ['loc']).slice(1).map(String).join('.')
  const message = stringAt(entry, ['msg']) ?? ''
  return location ? `${location}: ${message}` : message
}

function detailOf(body: ReadBody, response: Response): string {
  const detail = valueAt(body.json, ['detail'])
  if (typeof detail === 'string' && detail !== '') return detail
  const validation = arrayAt(body.json, ['detail'])
    .map(validationMessage)
    .filter(Boolean)
    .join('; ')
  return (
    validation ||
    stringAt(body.json, ['message']) ||
    stringAt(body.json, ['error', 'message']) ||
    body.text?.trim() ||
    response.statusText ||
    String(response.status)
  )
}

async function toRouterResponse(response: Response): Promise<RouterResponse> {
  const headers = parseRouterHeaders(response.headers, Date.now())
  const body = await readBody(response)
  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      headers,
      json: body.json,
      blob: body.blob,
      contentType: body.contentType
    }
  }
  return {
    ok: false,
    reason: 'refused',
    status: response.status,
    errorType: headers.errorType ?? stringAt(body.json, ['error_type']),
    detail: detailOf(body, response),
    headers
  }
}

function requestInit(request: RouterRequest, header: AuthHeader): RequestInit {
  const hasBody = request.body !== undefined
  return {
    method: request.method,
    headers: {
      ...header,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(request.idempotencyKey
        ? { 'Idempotency-Key': request.idempotencyKey }
        : {})
    },
    body: hasBody ? JSON.stringify(request.body) : undefined,
    signal: combineAbortSignals(
      compact([request.signal, AbortSignal.timeout(request.timeoutMs)])
    )
  }
}

async function send(
  request: RouterRequest,
  header: AuthHeader
): Promise<RouterResponse> {
  try {
    const response = await fetchWithUnifiedRemint(
      routerUrl(request.path),
      requestInit(request, header),
      await shouldRemintCloudRequest(),
      undefined,
      NO_RETRY_POLICY
    )
    return await toRouterResponse(response)
  } catch (error) {
    return {
      ok: false,
      reason: 'network',
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

async function credentialHeader(
  kind: CredentialKind
): Promise<AuthHeader | null> {
  const auth = useAuthStore()
  try {
    return kind === 'workspace'
      ? await auth.getWorkspaceAuthHeader()
      : await auth.getFirebaseAuthHeader()
  } catch {
    return null
  }
}

type RefusedResponse = Extract<RouterResponse, { reason: 'refused' }>

function isCredentialRefusal(
  response: RouterResponse
): response is RefusedResponse {
  if (response.ok || response.reason !== 'refused') return false
  return (
    response.status === 401 ||
    (response.status === 403 && response.errorType === 'unauthorized')
  )
}

export function createRouterClient(): RouterClient {
  let preferred: CredentialKind = 'workspace'

  const order = (): CredentialKind[] =>
    preferred === 'workspace'
      ? ['workspace', 'firebase']
      : ['firebase', 'workspace']

  async function fetchRouter(request: RouterRequest): Promise<RouterResponse> {
    const tried = new Set<string>()
    let refusal = ''
    for (const kind of order()) {
      const header = await credentialHeader(kind)
      const identity = JSON.stringify(header)
      if (!header || tried.has(identity)) continue
      tried.add(identity)
      const response = await send(request, header)
      if (isCredentialRefusal(response)) {
        refusal = response.detail
        continue
      }
      if (response.ok || response.reason !== 'network') preferred = kind
      return response
    }
    return { ok: false, reason: 'unauthenticated', detail: refusal }
  }

  return { fetch: fetchRouter }
}

export function routerFailureMessage(failure: RouterFailure): string {
  switch (failure.reason) {
    case 'refused':
      return failure.errorType
        ? `${failure.detail} (${failure.errorType})`
        : failure.detail
    case 'unauthenticated':
      return t('superComfy.model.signInRefused')
    case 'network':
      return failure.message
  }
}

const sharedClient = createRouterClient()

export function routerFetch(request: RouterRequest): Promise<RouterResponse> {
  return sharedClient.fetch(request)
}
