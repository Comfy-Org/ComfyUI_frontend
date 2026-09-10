/**
 * The workspace session: a short-lived JWT minted from the signed-in
 * identity, which is what actually authorizes runs and balance reads.
 *
 * The exchange parses the generated contract for POST /auth/token and keeps
 * the cloud app's error taxonomy for it. The freshness strategy is
 * valid-on-read (callers await
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

import type { AccountIdentity } from './identity.js'
import { isAccountIdentity } from './identity.js'
import {
  CredentialResponseSchema,
  abortable,
  exchangeToken
} from './exchange.js'

export type { AccountIdentity } from './identity.js'

export interface AccountUser {
  readonly uid: string
  getIdToken: () => Promise<string>
}

/** The generated contract for POST /api/auth/token, never a local copy of it. */
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

export { SESSION_TELEMETRY_EVENT } from '../telemetry.js'

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
 * get their implementation from `@comfyorg/account/firebase`; tests brand a
 * fake through `@comfyorg/account/testing`. `attachIdentity` accepts only
 * the branded form.
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
}

export interface SessionClientOptions extends SessionRequestOptions {
  readonly exchangeUrl: string
  readonly storage: CredentialStorage
  readonly freshMarginMs?: number
}

/**
 * `pending` is the initial phase, before the attached identity has delivered
 * even once, so a host can tell "Firebase has not answered yet" (pending)
 * from "nobody is signed in" (a delivered null) without wrapping the port.
 */
export type SessionSnapshot<TUser extends AccountUser = AccountUser> =
  | {
      readonly phase: 'pending'
      readonly user: null
      readonly session: undefined
    }
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

export interface SessionClient<TUser extends AccountUser = AccountUser> {
  attachIdentity: (identity: AccountIdentity<TUser>) => () => void
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
   * Concurrent callers for one user share one in-flight mint, which runs
   * with the first caller's `timeoutMs`; a later caller's own `signal`
   * still releases that caller (with a transient failure) without
   * cancelling the shared mint.
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
   * Drops only the persisted copy of the credential. The published session
   * stays live; a host that must end it detaches or invalidates as well.
   */
  clearStoredCredential: () => void
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
export function createSessionClient<TUser extends AccountUser = AccountUser>(
  clientOptions: SessionClientOptions
): SessionClient<TUser> {
  const {
    exchangeUrl,
    storage,
    freshMarginMs = DEFAULT_FRESH_MARGIN_MS
  } = clientOptions

  let currentUser: TUser | null = null
  let identitySettled = false
  let credential: AccountCredential | undefined
  let failure: SessionFailure | undefined
  let detachCurrent: (() => void) | undefined
  /**
   * Bumped on every identity event so a mint can tell "the listener has not
   * settled yet" (the legitimate popup path) from "an identity event
   * happened while I was in flight" (must invalidate).
   */
  let identityEpoch = 0
  const listeners = new Set<(snapshot: SessionSnapshot<TUser>) => void>()

  let inFlight: Promise<SessionResult> | undefined
  let inFlightUid: string | undefined
  let inFlightForced = false

  function getSnapshot(): SessionSnapshot<TUser> {
    if (!currentUser) {
      return identitySettled
        ? { phase: 'signed-out', user: null, session: undefined }
        : { phase: 'pending', user: null, session: undefined }
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
   * The package's thin wrapper over the pure exchange: resolves the host's
   * transport/timeout/clock defaults and sends the personal-workspace body.
   */
  function mint(
    user: AccountUser,
    options: SessionRequestOptions
  ): Promise<SessionResult> {
    return exchangeToken(user, {
      exchangeUrl,
      body: {},
      fetchImpl:
        options.fetchImpl ?? clientOptions.fetchImpl ?? globalThis.fetch,
      signal: options.signal ?? clientOptions.signal,
      timeoutMs:
        options.timeoutMs ?? clientOptions.timeoutMs ?? DEFAULT_MINT_TIMEOUT_MS,
      now: () => options.now?.() ?? clientOptions.now?.() ?? Date.now()
    })
  }

  /**
   * Later callers for the same uid reuse one in-flight mint. A forced mint
   * reuses an in-flight mint only when that one is also forced, so a 401
   * retry never resolves to a non-forced mint still holding the stale token.
   */
  /**
   * A sign-out or a different user makes the running mint unjoinable: it
   * was started with the previous identity's token, and a caller arriving
   * after the event must mint for itself.
   */
  function abandonInFlight(): void {
    inFlight = undefined
    inFlightUid = undefined
    inFlightForced = false
  }

  function sharedMint(
    user: AccountUser,
    options: SessionRequestOptions,
    forced: boolean
  ): Promise<SessionResult> {
    if (
      inFlight !== undefined &&
      inFlightUid === user.uid &&
      (!forced || inFlightForced)
    ) {
      return inFlight
    }
    inFlightUid = user.uid
    inFlightForced = forced
    const running = mint(user, options).finally(() => {
      if (inFlight !== running) return
      inFlight = undefined
      inFlightUid = undefined
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
    // The first FRESH credential wins, storage before memory: a stale stored
    // record (a write that failed after a later mint) must not shadow the
    // live one, and a host whose storage is blocked must not pay a full
    // exchange on every read.
    const fresh = [
      readCached(user.uid),
      credential?.uid === user.uid ? credential : undefined
    ].find(
      (candidate) =>
        candidate !== undefined &&
        isCredentialFresh(candidate, now, freshMarginMs)
    )
    if (fresh) {
      return Promise.resolve({ status: 'ok', session: fresh })
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
    const startedSignedOut = currentUser === null
    // A caller that joined an in-flight mint still gets its own signal
    // honored: the shared mint runs on, this caller stops waiting for it.
    let result: SessionResult
    try {
      const response = core(user, options)
      result = options.signal
        ? await abortable(response, options.signal)
        : await response
    } catch {
      return { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    }
    if (identityEpoch !== startEpoch) {
      // The one mint allowed to cross an identity event: an explicit-user
      // mint started while signed out, for the user the port then
      // delivered (the popup path). Everything else was minted for an
      // identity that is gone, even when the uid matches again.
      const popupSettled =
        requestedUser !== undefined &&
        startedSignedOut &&
        currentUser?.uid === user.uid
      if (!popupSettled) return undefined
    } else if (
      currentUser?.uid !== user.uid &&
      (!requestedUser || currentUser !== null)
    ) {
      return undefined
    }
    if (result.status === 'ok') {
      credential = result.session
      failure = undefined
      safeWrite(JSON.stringify(result.session))
    } else {
      credential = undefined
      failure = result
    }
    publish()
    return result
  }

  return {
    attachIdentity(identity) {
      if (!isAccountIdentity(identity)) {
        throw new Error(
          'attachIdentity needs the identity from @comfyorg/account/firebase (or /testing)'
        )
      }
      detachCurrent?.()
      let active = true
      const unsubscribe = identity.onUserChanged((next) => {
        if (!active) return
        identityEpoch += 1
        identitySettled = true
        if (!next || next.uid !== currentUser?.uid) abandonInFlight()
        currentUser = next
        credential = undefined
        failure = undefined
        if (!next) {
          safeClear()
          publish()
          return
        }
        publish()
        void refreshWith(ensureCore, next)
      })
      const detach = () => {
        if (!active) return
        active = false
        identityEpoch += 1
        detachCurrent = undefined
        unsubscribe()
        currentUser = null
        identitySettled = false
        credential = undefined
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
    clearStoredCredential() {
      safeClear()
    }
  }
}
