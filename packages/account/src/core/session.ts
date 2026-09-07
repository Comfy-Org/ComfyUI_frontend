/**
 * The workspace session: a short-lived JWT minted from the signed-in
 * identity, which is what actually authorizes runs and balance reads.
 *
 * The exchange contract, response schema, and error taxonomy are extracted
 * from the cloud app's production implementation of this same POST
 * /auth/token call (`requestToken` in
 * src/platform/workspace/stores/workspaceAuthStore.ts) — keep the two in
 * step. Only the freshness strategy differs: valid-on-read (callers await
 * `ensureFresh` at the moment they need a token; it never resolves with
 * less than `freshMarginMs` of validity) rather than a proactive refresh
 * timer, because background tabs throttle timers and this package's callers
 * can await. A host that needs proactive refresh wraps this client with its
 * own scheduler.
 *
 * The credential cache sits behind the host's storage adapter keyed to the
 * signed-in uid, so a token survives a reload but can never be served to a
 * different signed-in user.
 */
import { z } from 'zod'

import { zWorkspaceWithRole } from '@comfyorg/ingest-types/zod'

export interface AccountUser {
  readonly uid: string
  getIdToken: () => Promise<string>
}

const CredentialResponseSchema = z.object({
  token: z.string(),
  expires_at: z.string(),
  workspace: zWorkspaceWithRole.pick({ id: true, name: true, type: true }),
  role: zWorkspaceWithRole.shape.role,
  permissions: z.array(z.string())
})

const CachedCredentialSchema = CredentialResponseSchema.omit({
  expires_at: true
}).extend({
  expiresAt: z.number(),
  uid: z.string()
})

export interface AccountCredential {
  readonly token: string
  /** ms since epoch */
  readonly expiresAt: number
  readonly uid: string
  readonly workspace: z.infer<typeof CredentialResponseSchema>['workspace']
  readonly role: z.infer<typeof CredentialResponseSchema>['role']
  readonly permissions: readonly string[]
}

/**
 * The production store's error taxonomy (`WorkspaceAuthError` codes),
 * emitted as codes only — the host localizes. TOKEN_EXCHANGE_FAILED also
 * covers unparseable bodies, network failures, aborts, and timeouts: a
 * request that produced no usable credential is one failure bucket in
 * production, not three.
 */
export type SessionErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'INVALID_FIREBASE_TOKEN'
  | 'ACCESS_DENIED'
  | 'WORKSPACE_NOT_FOUND'
  | 'TOKEN_EXCHANGE_FAILED'

const PERMANENT_ERROR_CODES: ReadonlySet<SessionErrorCode> = new Set([
  'ACCESS_DENIED',
  'WORKSPACE_NOT_FOUND',
  'INVALID_FIREBASE_TOKEN',
  'NOT_AUTHENTICATED'
])

export function isPermanentSessionError(code: SessionErrorCode): boolean {
  return PERMANENT_ERROR_CODES.has(code)
}

/**
 * English source strings for the codes above, extracted verbatim from the
 * cloud app's shipped copy (src/locales/en/main.json, workspaceAuth.errors)
 * so hosts never invent independently worded copy for the same failure.
 * A host may localize, but generic copy starts from these strings.
 */
export const SESSION_ERROR_MESSAGES: Readonly<
  Record<SessionErrorCode, string>
> = {
  NOT_AUTHENTICATED: 'You must be logged in to access workspaces',
  INVALID_FIREBASE_TOKEN: 'Authentication failed. Please try logging in again.',
  ACCESS_DENIED: 'You do not have access to this workspace',
  WORKSPACE_NOT_FOUND: 'Workspace not found',
  TOKEN_EXCHANGE_FAILED: 'Failed to authenticate with workspace'
}

/**
 * Shared telemetry vocabulary, matching the cloud app's
 * TelemetryEvents.UNIFIED_AUTH_REFRESH_* names and
 * UnifiedAuthRefreshOutcome union verbatim, so a session-mint outcome is
 * one queryable event across every host. The package never calls a
 * telemetry API itself — call sites stay host-specific.
 */
/**
 * English source strings for the signed-in states the Workshop site already
 * ships; a host that surfaces sign-in success starts from these rather than
 * inventing new copy. The cloud app currently surfaces nothing on success —
 * adopting these there is a product decision, not a requirement.
 */
export const SESSION_SUCCESS_MESSAGES = {
  signedInHeading: 'You are signed in',
  signedInAs: 'Signed in as'
} as const

export const SESSION_TELEMETRY_EVENT = {
  refreshSucceeded: 'auth.unified.refresh.succeeded',
  refreshFailed: 'auth.unified.refresh.failed'
} as const

export type SessionRefreshOutcome =
  | 'succeeded'
  | 'retry_scheduled'
  | 'retries_exhausted'
  | 'permanent_failure'

export type SessionResult =
  | { readonly status: 'ok'; readonly session: AccountCredential }
  | {
      readonly status: 'error'
      readonly code: SessionErrorCode
      /** Set only when the failure came from an HTTP response, not aborted/network. */
      readonly httpStatus?: number
    }

export type SessionFailure = Extract<SessionResult, { status: 'error' }>

/**
 * The identity boundary. An internal port, not a host adapter: real hosts
 * get their implementation from `@comfyorg/account/firebase`; tests pass
 * fakes.
 */
export interface IdentityPort<TUser extends AccountUser = AccountUser> {
  onUserChanged: (callback: (user: TUser | null) => void) => () => void
}

/**
 * Raw string storage for the credential cache. Hosts wrap their medium —
 * per-tab browser storage today, a cookie-backed session tomorrow. Each client
 * instance sees only its own storage: signing out in one tab leaves another
 * tab's session live until the server revokes it and the next remint 401s.
 */
export interface CredentialStorage {
  read: () => string | null
  write: (value: string) => void
  clear: () => void
}

export interface SessionRequestOptions {
  readonly fetchImpl?: typeof fetch
  readonly now?: () => number
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
  /** Mint for this workspace instead of the server-resolved personal one. */
  readonly workspaceId?: string
  /**
   * On a transient remint failure, keep the currently published credential
   * instead of committing the error — for hosts whose still-valid token
   * must survive a failed proactive or reactive refresh. Permanent
   * failures always commit.
   */
  readonly preserveCredentialOnTransientFailure?: boolean
}

/**
 * Opt-in proactive refresh, mirroring the cloud store's scheduled-refresh
 * semantics (its buffer, retry base, and retry cap are the defaults): arm at
 * expiry minus the buffer, retry transient failures with doubling backoff,
 * stop on sign-out, detach, or a permanent failure. Hosts whose consumers
 * read the token synchronously need this; valid-on-read hosts do not.
 */
export interface RefreshSchedulerOptions {
  readonly bufferMs?: number
  readonly retryBaseMs?: number
  readonly maxRetries?: number
  /**
   * Called with the outcome of every SCHEDULED refresh attempt (never a
   * login or caller-initiated mint), so a host can feed its refresh
   * telemetry without owning the scheduler.
   */
  readonly onScheduledOutcome?: (outcome: SessionRefreshOutcome) => void
}

export interface SessionClientOptions extends SessionRequestOptions {
  readonly exchangeUrl: string
  readonly storage: CredentialStorage
  readonly freshMarginMs?: number
  readonly refreshScheduler?: RefreshSchedulerOptions
}

export type SessionSnapshot<TUser extends AccountUser = AccountUser> =
  | {
      readonly phase: 'signed-out'
      readonly user: null
      readonly session: undefined
    }
  | {
      readonly phase: 'minting'
      readonly user: TUser
      readonly session: undefined
    }
  | {
      readonly phase: 'authenticated'
      readonly user: TUser
      readonly session: AccountCredential
    }
  | {
      readonly phase: 'error'
      readonly user: TUser
      readonly session: undefined
      readonly failure: SessionFailure
    }

export interface AttachIdentityOptions {
  /**
   * When false, an identity event sets the user and publishes without
   * starting a warm-up mint — for hosts that drive every mint explicitly.
   */
  readonly autoMint?: boolean
}

export interface SessionClient<TUser extends AccountUser = AccountUser> {
  attachIdentity: (
    identity: IdentityPort<TUser>,
    options?: AttachIdentityOptions
  ) => () => void
  getSnapshot: () => SessionSnapshot<TUser>
  subscribe: (
    listener: (snapshot: SessionSnapshot<TUser>) => void
  ) => () => void
  /** The current credential's token, uid-guarded. No freshness promise. */
  getToken: () => string | undefined
  /**
   * The valid-on-read entry point: resolves with a session that has more
   * than `freshMarginMs` of validity, minting inside the call when the
   * cache cannot promise that. Resolves undefined when nobody is signed in
   * or when the identity changed while the mint was in flight.
   *
   * An explicit-user call made before the identity port has ever fired
   * (the popup path) resolves with the result, and the credential is
   * cached — but the snapshot and getToken() stay signed-out until the
   * port delivers that user, since the snapshot's user is the port's.
   */
  ensureFresh: (
    requestedUser?: AccountUser,
    options?: SessionRequestOptions
  ) => Promise<SessionResult | undefined>
  /** A mint that ignores the cache — for the one 401-retry a read allows. */
  remint: (
    requestedUser?: AccountUser,
    options?: SessionRequestOptions
  ) => Promise<SessionResult | undefined>
  /**
   * Fail closed: drop the published credential, cancel scheduled work, and
   * invalidate in-flight mints, keeping the identity attachment so a
   * targeted re-mint can follow. For host flows like a workspace switch.
   */
  invalidate: () => void
  clearCache: () => void
}

const DEFAULT_FRESH_MARGIN_MS = 5 * 60 * 1000
const DEFAULT_MINT_TIMEOUT_MS = 15_000

export function isCredentialFresh(
  session: AccountCredential,
  now: number,
  freshMarginMs: number = DEFAULT_FRESH_MARGIN_MS
): boolean {
  return session.expiresAt - now > freshMarginMs
}

/**
 * The status→code mapping from `requestToken`: 401/403/404 are permanent
 * failures with their own codes; everything else — 5xx, network failure,
 * abort, unparseable body — collapses to TOKEN_EXCHANGE_FAILED, matching
 * production's default branch.
 */
function codeForResponse(status: number): SessionErrorCode {
  if (status === 401) return 'INVALID_FIREBASE_TOKEN'
  if (status === 403) return 'ACCESS_DENIED'
  if (status === 404) return 'WORKSPACE_NOT_FOUND'
  return 'TOKEN_EXCHANGE_FAILED'
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

export function createSessionClient<TUser extends AccountUser = AccountUser>(
  clientOptions: SessionClientOptions
): SessionClient<TUser> {
  const {
    exchangeUrl,
    storage,
    freshMarginMs = DEFAULT_FRESH_MARGIN_MS
  } = clientOptions

  let currentUser: TUser | null = null
  let credential: AccountCredential | undefined
  let credentialTarget: string | undefined
  let failure: SessionFailure | undefined
  let detachCurrent: (() => void) | undefined
  /**
   * Bumped on every identity event so a mint can tell "the listener has not
   * settled yet" (the legitimate popup path) from "an identity event
   * happened while I was in flight" (must invalidate).
   */
  let identityEpoch = 0
  let invalidationEpoch = 0
  const listeners = new Set<(snapshot: SessionSnapshot<TUser>) => void>()

  let inFlight: Promise<SessionResult> | undefined
  let inFlightUid: string | undefined
  let inFlightTarget: string | undefined
  let inFlightForced = false

  function getSnapshot(): SessionSnapshot<TUser> {
    if (!currentUser) {
      return { phase: 'signed-out', user: null, session: undefined }
    }
    if (credential) {
      return { phase: 'authenticated', user: currentUser, session: credential }
    }
    if (failure) {
      return { phase: 'error', user: currentUser, session: undefined, failure }
    }
    return { phase: 'minting', user: currentUser, session: undefined }
  }

  function publish(): void {
    const snapshot = getSnapshot()
    listeners.forEach((listener) => listener(snapshot))
  }

  function safeRead(): string | null {
    try {
      return storage.read()
    } catch {
      return null
    }
  }

  function safeWrite(value: string): void {
    try {
      storage.write(value)
    } catch {
      void 0
    }
  }

  function safeClear(): void {
    try {
      storage.clear()
    } catch {
      void 0
    }
  }

  function readCached(uid: string): AccountCredential | undefined {
    const raw = safeRead()
    if (raw === null) return undefined
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return undefined
    }
    const result = CachedCredentialSchema.safeParse(parsed)
    if (!result.success || result.data.uid !== uid) return undefined
    return {
      token: result.data.token,
      expiresAt: result.data.expiresAt,
      uid: result.data.uid,
      workspace: result.data.workspace,
      role: result.data.role,
      permissions: result.data.permissions
    }
  }

  /**
   * Pure network + parse: the schema, the status→code mapping, and the
   * malformed-body handling match `requestToken`. The AbortSignal/timeout
   * plumbing is this package's addition — production's callers are
   * timer-scheduled, these are user-cancelable.
   */
  async function mint(
    user: AccountUser,
    options: SessionRequestOptions
  ): Promise<SessionResult> {
    const {
      fetchImpl = clientOptions.fetchImpl ?? globalThis.fetch,
      signal = clientOptions.signal,
      timeoutMs = clientOptions.timeoutMs ?? DEFAULT_MINT_TIMEOUT_MS,
      workspaceId = clientOptions.workspaceId
    } = options

    if (signal?.aborted) {
      return { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    }

    const startEpoch = identityEpoch
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      let idToken: string
      try {
        idToken = await abortable(user.getIdToken(), controller.signal)
      } catch (error) {
        // requestToken treats a missing identity token as NOT_AUTHENTICATED;
        // an identity failure carrying that code keeps it, anything else
        // (including our own abort) stays in the transient bucket.
        const coded =
          !controller.signal.aborted &&
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'NOT_AUTHENTICATED'
        return {
          status: 'error',
          code: coded ? 'NOT_AUTHENTICATED' : 'TOKEN_EXCHANGE_FAILED'
        }
      }

      let response: Response
      try {
        response = await fetchImpl(exchangeUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          // Same body construction as requestToken: an explicit workspace_id,
          // or an empty body the backend resolves to the personal workspace.
          body: JSON.stringify(
            workspaceId ? { workspace_id: workspaceId } : {}
          ),
          signal: controller.signal
        })
      } catch {
        return { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
      }

      if (!response.ok) {
        return {
          status: 'error',
          code: codeForResponse(response.status),
          httpStatus: response.status
        }
      }

      let rawBody: unknown
      try {
        // The timeout stays armed through the body read: headers arriving
        // does not bound the body, and a stalled body must abort exactly
        // like a stalled connect.
        rawBody = await abortable(response.json(), controller.signal)
      } catch {
        return {
          status: 'error',
          code: 'TOKEN_EXCHANGE_FAILED',
          httpStatus: response.status
        }
      }

      const parseResult = CredentialResponseSchema.safeParse(rawBody)
      if (!parseResult.success) {
        return {
          status: 'error',
          code: 'TOKEN_EXCHANGE_FAILED',
          httpStatus: response.status
        }
      }
      // Date.parse can yield NaN on a schema-valid string, so the expiry gets
      // its own check after the schema, as in production.
      const expiresAt = Date.parse(parseResult.data.expires_at)
      if (Number.isNaN(expiresAt)) {
        return {
          status: 'error',
          code: 'TOKEN_EXCHANGE_FAILED',
          httpStatus: response.status
        }
      }

      const session: AccountCredential = {
        token: parseResult.data.token,
        expiresAt,
        uid: user.uid,
        workspace: parseResult.data.workspace,
        role: parseResult.data.role,
        permissions: parseResult.data.permissions
      }
      // The cache write consults the identity epoch like the in-memory
      // commit does: a mint outliving a sign-out or detach must not
      // resurrect the session in persistent storage.
      if (identityEpoch === startEpoch) {
        safeWrite(
          JSON.stringify({
            ...session,
            expires_at: parseResult.data.expires_at
          })
        )
      }
      return { status: 'ok', session }
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }

  /**
   * Later callers for the same uid reuse one in-flight mint. A forced mint
   * reuses an in-flight mint only when that one is also forced, so a 401
   * retry never resolves to a non-forced mint still holding the stale token.
   */
  function sharedMint(
    user: AccountUser,
    options: SessionRequestOptions,
    forced: boolean
  ): Promise<SessionResult> {
    const target = options.workspaceId ?? clientOptions.workspaceId
    if (
      inFlight !== undefined &&
      inFlightUid === user.uid &&
      inFlightTarget === target &&
      (!forced || inFlightForced)
    ) {
      return inFlight
    }
    inFlightUid = user.uid
    inFlightTarget = target
    inFlightForced = forced
    const running = mint(user, options).finally(() => {
      if (inFlight !== running) return
      inFlight = undefined
      inFlightUid = undefined
      inFlightTarget = undefined
      inFlightForced = false
    })
    inFlight = running
    return running
  }

  function ensureCore(
    user: AccountUser,
    options: SessionRequestOptions
  ): Promise<SessionResult> {
    const now = options.now?.() ?? clientOptions.now?.() ?? Date.now()
    const target = options.workspaceId ?? clientOptions.workspaceId
    const cached = readCached(user.uid)
    if (
      cached &&
      isCredentialFresh(cached, now, freshMarginMs) &&
      (target === undefined || cached.workspace.id === target)
    ) {
      return Promise.resolve({ status: 'ok', session: cached })
    }
    return sharedMint(user, options, false)
  }

  function remintCore(
    user: AccountUser,
    options: SessionRequestOptions
  ): Promise<SessionResult> {
    safeClear()
    return sharedMint(user, options, true)
  }

  const schedulerBufferMs =
    clientOptions.refreshScheduler?.bufferMs ?? DEFAULT_FRESH_MARGIN_MS
  const schedulerRetryBaseMs =
    clientOptions.refreshScheduler?.retryBaseMs ?? 5000
  const schedulerMaxRetries = clientOptions.refreshScheduler?.maxRetries ?? 3
  let scheduledTimer: ReturnType<typeof setTimeout> | undefined
  let scheduledRetryCount = 0

  function stopScheduledRefresh(): void {
    if (scheduledTimer !== undefined) {
      clearTimeout(scheduledTimer)
      scheduledTimer = undefined
    }
  }

  function armScheduledRefresh(expiresAt: number): void {
    if (!clientOptions.refreshScheduler) return
    stopScheduledRefresh()
    scheduledRetryCount = 0
    const now = clientOptions.now?.() ?? Date.now()
    scheduledTimer = setTimeout(
      () => {
        scheduledTimer = undefined
        void runScheduledRefresh()
      },
      Math.max(0, expiresAt - schedulerBufferMs - now)
    )
  }

  /**
   * The scheduled re-mint mirrors the cloud store's refresh semantics: a
   * transient failure keeps the still-valid credential and retries with
   * doubling backoff; a permanent failure commits the error; exhausted
   * retries leave recovery to the next valid-on-read call.
   */
  async function runScheduledRefresh(): Promise<void> {
    const user = currentUser
    if (!user) return
    const reportOutcome = clientOptions.refreshScheduler?.onScheduledOutcome
    const startEpoch = identityEpoch
    const startInvalidation = invalidationEpoch
    // Refresh with the target that produced the live credential, so a
    // scheduled refresh reproduces the same session AND coalesces with any
    // concurrent reactive re-mint for it.
    let result: SessionResult
    try {
      result = await sharedMint(user, { workspaceId: credentialTarget }, true)
    } catch {
      result = { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    }
    if (
      currentUser?.uid !== user.uid ||
      identityEpoch !== startEpoch ||
      invalidationEpoch !== startInvalidation
    )
      return
    if (result.status === 'ok') {
      credential = result.session
      failure = undefined
      publish()
      armScheduledRefresh(result.session.expiresAt)
      reportOutcome?.('succeeded')
      return
    }
    if (isPermanentSessionError(result.code)) {
      credential = undefined
      failure = result
      safeClear()
      publish()
      reportOutcome?.('permanent_failure')
      return
    }
    if (scheduledRetryCount >= schedulerMaxRetries) {
      reportOutcome?.('retries_exhausted')
      return
    }
    const delay = schedulerRetryBaseMs * 2 ** scheduledRetryCount
    scheduledRetryCount += 1
    stopScheduledRefresh()
    scheduledTimer = setTimeout(() => {
      scheduledTimer = undefined
      void runScheduledRefresh()
    }, delay)
    reportOutcome?.('retry_scheduled')
  }

  async function refreshWith(
    core: (
      user: AccountUser,
      options: SessionRequestOptions
    ) => Promise<SessionResult>,
    requestedUser?: AccountUser,
    options: SessionRequestOptions = {}
  ): Promise<SessionResult | undefined> {
    const user = requestedUser ?? currentUser
    if (!user) return undefined

    const startEpoch = identityEpoch
    const startInvalidation = invalidationEpoch
    const result = await core(user, options)
    if (invalidationEpoch !== startInvalidation) {
      return undefined
    }
    if (
      currentUser?.uid !== user.uid &&
      (identityEpoch !== startEpoch || !requestedUser || currentUser !== null)
    ) {
      return undefined
    }
    if (result.status === 'ok') {
      credential = result.session
      credentialTarget = options.workspaceId ?? clientOptions.workspaceId
      failure = undefined
      armScheduledRefresh(result.session.expiresAt)
    } else if (
      options.preserveCredentialOnTransientFailure === true &&
      credential !== undefined &&
      !isPermanentSessionError(result.code)
    ) {
      return result
    } else {
      credential = undefined
      failure = result
    }
    publish()
    return result
  }

  return {
    attachIdentity(identity, attachOptions) {
      detachCurrent?.()
      let active = true
      const unsubscribe = identity.onUserChanged((next) => {
        if (!active) return
        identityEpoch += 1
        stopScheduledRefresh()
        currentUser = next
        credential = undefined
        credentialTarget = undefined
        failure = undefined
        if (!next) {
          safeClear()
          publish()
          return
        }
        publish()
        if (attachOptions?.autoMint !== false) {
          void refreshWith(ensureCore, next)
        }
      })
      const detach = () => {
        if (!active) return
        active = false
        identityEpoch += 1
        detachCurrent = undefined
        unsubscribe()
        stopScheduledRefresh()
        currentUser = null
        credential = undefined
        credentialTarget = undefined
        failure = undefined
        publish()
      }
      detachCurrent = detach
      return detach
    },
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      listener(getSnapshot())
      return () => listeners.delete(listener)
    },
    getToken() {
      return credential !== undefined && currentUser?.uid === credential.uid
        ? credential.token
        : undefined
    },
    ensureFresh: (requestedUser, options) =>
      refreshWith(ensureCore, requestedUser, options),
    remint: (requestedUser, options) =>
      refreshWith(remintCore, requestedUser, options),
    invalidate() {
      invalidationEpoch += 1
      stopScheduledRefresh()
      credential = undefined
      credentialTarget = undefined
      failure = undefined
      publish()
    },
    clearCache() {
      safeClear()
    }
  }
}
