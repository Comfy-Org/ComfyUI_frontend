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
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

const STORAGE_KEY = 'comfy.workshop.session.v1'

/** Re-mint anything closer than this to expiry; the TTL is ~90 minutes. */
const FRESH_MARGIN_MS = 5 * 60 * 1000

export interface WorkshopSession {
  readonly token: string
  /** ms since epoch */
  readonly expiresAt: number
  readonly uid: string
  readonly workspace: {
    readonly id: string
    readonly name: string
    readonly type: 'personal' | 'team'
  }
  readonly role: 'owner' | 'member'
}

export type WorkshopSessionResult =
  | { readonly status: 'ok'; readonly session: WorkshopSession }
  | {
      readonly status: 'error'
      readonly reason: 'network' | 'http' | 'malformed'
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

function isWorkshopSession(value: unknown): value is WorkshopSession {
  if (!isRecord(value)) return false
  const workspace = value.workspace
  return (
    typeof value.token === 'string' &&
    typeof value.expiresAt === 'number' &&
    typeof value.uid === 'string' &&
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
  const { fetchImpl = globalThis.fetch, baseUrl = WORKSHOP_CLOUD_BASE_URL } =
    options

  let response: Response
  try {
    response = await fetchImpl(`${baseUrl}/api/auth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        'Content-Type': 'application/json'
      },
      // Empty body: the backend resolves the personal workspace.
      body: JSON.stringify({})
    })
  } catch {
    return { status: 'error', reason: 'network' }
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
    (body.role !== 'owner' && body.role !== 'member')
  ) {
    return { status: 'error', reason: 'malformed' }
  }

  const session: WorkshopSession = {
    token: body.token,
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
