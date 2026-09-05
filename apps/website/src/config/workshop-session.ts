/**
 * The workspace session: a short-lived JWT minted from the Firebase user,
 * which is what actually authorizes runs and balance reads.
 *
 * Freshness is valid-on-read (ADR 0011): callers await
 * `ensureFreshWorkshopSession` at the moment they need a token, and it never
 * resolves with less than five minutes of validity — anything closer
 * re-mints inside the call. Timers and focus checks elsewhere only warm this
 * up; they are never the guarantee, because browsers throttle them in
 * background tabs.
 *
 * The cache lives in sessionStorage keyed to the Firebase uid, so a token
 * survives a reload but can never be served to a different signed-in user.
 */
import type { ExchangeTokenResponse } from '@comfyorg/ingest-types'

import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

const STORAGE_KEY = 'comfy.workshop.session.v1'

/** Re-mint anything closer than this to expiry; the TTL is ~90 minutes. */
const FRESH_MARGIN_MS = 5 * 60 * 1000
const SESSION_MINT_TIMEOUT_MS = 15_000

export interface WorkshopSession extends Pick<
  ExchangeTokenResponse,
  'permissions' | 'role' | 'token' | 'workspace'
> {
  readonly token: string
  /** ms since epoch */
  readonly expiresAt: number
  readonly uid: string
}

export type WorkshopSessionResult =
  | { readonly status: 'ok'; readonly session: WorkshopSession }
  | {
      readonly status: 'error'
      readonly reason: 'aborted' | 'network' | 'http' | 'malformed' | 'timeout'
      readonly httpStatus?: number
    }

/** The slice of a Firebase user the session layer needs; injectable in tests. */
export interface WorkshopSessionUser {
  readonly uid: string
  getIdToken: () => Promise<string>
}

export interface WorkshopSessionOptions {
  readonly fetchImpl?: typeof fetch
  readonly baseUrl?: string
  readonly now?: () => number
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export function isWorkshopSessionFresh(
  session: WorkshopSession,
  now: number
): boolean {
  return session.expiresAt - now > FRESH_MARGIN_MS
}

export function readCachedWorkshopSession(
  uid: string
): WorkshopSession | undefined {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (!isWorkshopSession(parsed) || parsed.uid !== uid) return undefined
    return parsed
  } catch {
    // Corrupt JSON, or storage that throws outright (cookies disabled):
    // behave as if there were no cache.
    return undefined
  }
}

export function clearWorkshopSession(): void {
  try {
    globalThis.sessionStorage?.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

function writeCachedWorkshopSession(session: WorkshopSession): void {
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // A session that only lives in memory still works for this page.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

function isWorkshopSession(value: unknown): value is WorkshopSession {
  if (!isRecord(value)) return false
  const workspace = value.workspace
  return (
    typeof value.token === 'string' &&
    typeof value.expiresAt === 'number' &&
    typeof value.uid === 'string' &&
    Array.isArray(value.permissions) &&
    value.permissions.every((permission) => typeof permission === 'string') &&
    isRecord(workspace) &&
    typeof workspace.id === 'string' &&
    typeof workspace.name === 'string' &&
    (workspace.type === 'personal' || workspace.type === 'team') &&
    (value.role === 'owner' || value.role === 'member')
  )
}

async function mintWorkshopSession(
  user: WorkshopSessionUser,
  options: WorkshopSessionOptions
): Promise<WorkshopSessionResult> {
  const {
    fetchImpl = globalThis.fetch,
    baseUrl = WORKSHOP_CLOUD_BASE_URL,
    signal,
    timeoutMs = SESSION_MINT_TIMEOUT_MS
  } = options

  if (signal?.aborted) return { status: 'error', reason: 'aborted' }

  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    const idToken = await abortable(user.getIdToken(), controller.signal)
    response = await fetchImpl(`${baseUrl}/api/auth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      // Empty body: the backend resolves the personal workspace.
      body: JSON.stringify({}),
      signal: controller.signal
    })
  } catch {
    return {
      status: 'error',
      reason: signal?.aborted
        ? 'aborted'
        : controller.signal.aborted
          ? 'timeout'
          : 'network'
    }
  } finally {
    globalThis.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }

  if (!response.ok) {
    return { status: 'error', reason: 'http', httpStatus: response.status }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { status: 'error', reason: 'malformed' }
  }
  if (!isRecord(body) || typeof body.token !== 'string') {
    return { status: 'error', reason: 'malformed' }
  }
  const expiresAt = Date.parse(
    typeof body.expires_at === 'string' ? body.expires_at : ''
  )
  const workspace = body.workspace
  if (
    Number.isNaN(expiresAt) ||
    !isRecord(workspace) ||
    typeof workspace.id !== 'string' ||
    typeof workspace.name !== 'string' ||
    (workspace.type !== 'personal' && workspace.type !== 'team') ||
    !Array.isArray(body.permissions) ||
    !body.permissions.every(
      (permission): permission is string => typeof permission === 'string'
    ) ||
    (body.role !== 'owner' && body.role !== 'member')
  ) {
    return { status: 'error', reason: 'malformed' }
  }

  const session: WorkshopSession = {
    token: body.token,
    permissions: body.permissions,
    expiresAt,
    uid: user.uid,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type
    },
    role: body.role
  }
  writeCachedWorkshopSession(session)
  return { status: 'ok', session }
}

let inFlight: Promise<WorkshopSessionResult> | undefined
let inFlightUid: string | undefined
let inFlightForced = false

/**
 * Later callers for the same uid reuse one in-flight mint. A `forced` mint
 * reuses an in-flight mint only when that one is also forced, so a 401 retry
 * never resolves to a non-forced mint still holding the stale token.
 */
function sharedMint(
  user: WorkshopSessionUser,
  options: WorkshopSessionOptions,
  forced: boolean
): Promise<WorkshopSessionResult> {
  if (
    inFlight !== undefined &&
    inFlightUid === user.uid &&
    (!forced || inFlightForced)
  ) {
    return inFlight
  }
  inFlightUid = user.uid
  inFlightForced = forced
  const mint = mintWorkshopSession(user, options).finally(() => {
    if (inFlight !== mint) return
    inFlight = undefined
    inFlightUid = undefined
    inFlightForced = false
  })
  inFlight = mint
  return mint
}

/**
 * The valid-on-read entry point: resolves with a session that has more than
 * five minutes of validity, minting inside the call when the cache cannot
 * promise that.
 */
export function ensureFreshWorkshopSession(
  user: WorkshopSessionUser,
  options: WorkshopSessionOptions = {}
): Promise<WorkshopSessionResult> {
  const now = options.now?.() ?? Date.now()
  const cached = readCachedWorkshopSession(user.uid)
  if (cached && isWorkshopSessionFresh(cached, now)) {
    return Promise.resolve({ status: 'ok', session: cached })
  }
  return sharedMint(user, options, false)
}

/** A mint that ignores the cache — for the one 401-retry a run is allowed. */
export function remintWorkshopSession(
  user: WorkshopSessionUser,
  options: WorkshopSessionOptions = {}
): Promise<WorkshopSessionResult> {
  clearWorkshopSession()
  return sharedMint(user, options, true)
}
