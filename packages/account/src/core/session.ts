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

import type { AccountIdentity } from './identity.js'
import { isAccountIdentity } from './identity.js'
import {
  CredentialResponseSchema,
  abortable,
  exchangeToken
} from './exchange.js'
import type { RefreshHost } from './refreshScheduler.js'
import { createRefreshScheduler } from './refreshScheduler.js'

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
  uid: z.string(),
  /** The workspace target the credential was minted for; absent = personal. */
  target: z.string().optional()
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
  /** The credential reached its expiry after retries ran out; the client failed closed. */
  | 'expired'

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
 * A started mint and the monotonic id it took. Later callers for the same
 * uid reuse one in-flight mint; a forced mint reuses an in-flight one only
 * when that one is also forced, so a 401 retry never resolves to a
 * non-forced mint still holding the stale token.
 */
export interface MintHandle {
  readonly mintId: number
  readonly response: Promise<SessionResult>
}

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
 * Cross-tab refresh coordination. One tab per (uid, workspace) key holds the
 * lease and performs the proactive refresh; the others adopt its published
 * credential and mint for themselves only when the leader goes quiet past
 * their jittered fallback. Real hosts wrap Web Locks + BroadcastChannel
 * (`createWebCrossTabRefreshPort` from `@comfyorg/account/web`); tests pass
 * fakes.
 */
export interface CrossTabRefreshPort {
  /**
   * Queue for the key's lease. `onAcquired` fires if and when this tab
   * becomes leader; the returned function abandons the request or releases
   * held leadership.
   */
  requestLeadership: (key: string, onAcquired: () => void) => () => void
  publishCredential: (key: string, credential: AccountCredential) => void
  /** Messages cross a serialization boundary; the client validates them. */
  onCredential: (
    key: string,
    callback: (message: unknown) => void
  ) => () => void
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
   * Cross-tab coordination (opt-in): the leader tab refreshes and publishes;
   * followers adopt the published credential and fall back to their own mint
   * only after a bounded random hold past the refresh point.
   */
  readonly crossTab?: {
    readonly port: CrossTabRefreshPort
    /** Upper bound for the follower's random hold. Default 15s. */
    readonly followerJitterMs?: number
    /**
     * Fires when this tab commits a sibling's credential. Adoption is a
     * rotation the tab did not perform itself, so a host that reacts to
     * rotations (cookie refresh, extension hooks) needs this signal.
     */
    readonly onCredentialAdopted?: (credential: AccountCredential) => void
  }
  /**
   * Called with the outcome of every SCHEDULED refresh attempt (never a
   * login or caller-initiated mint), so a host can feed its refresh
   * telemetry without owning the scheduler. A permanent failure and an
   * expiry carry the failure the client committed, so the host never has
   * to read it back out of the snapshot.
   */
  readonly onScheduledOutcome?: (
    outcome: SessionRefreshOutcome,
    failure?: SessionFailure
  ) => void
}

export interface SessionClientOptions extends SessionRequestOptions {
  readonly exchangeUrl: string
  readonly storage: CredentialStorage
  readonly freshMarginMs?: number
  readonly refreshScheduler?: RefreshSchedulerOptions
}

/**
 * `settled` is false until the attached identity has delivered at least
 * once, so a host can tell "Firebase has not answered yet" from "nobody is
 * signed in" without wrapping the port.
 */
export type SessionSnapshot<TUser extends AccountUser = AccountUser> =
  | {
      readonly phase: 'signed-out'
      readonly user: null
      readonly session: undefined
      readonly settled: boolean
    }
  | {
      readonly phase: 'minting'
      readonly user: TUser
      readonly session: undefined
      readonly settled: true
    }
  | {
      readonly phase: 'authenticated'
      readonly user: TUser
      readonly session: AccountCredential
      readonly settled: true
    }
  | {
      readonly phase: 'error'
      readonly user: TUser
      readonly session: undefined
      readonly failure: SessionFailure
      readonly settled: true
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
    identity: AccountIdentity<TUser>,
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
   * cache cannot promise that. Resolves undefined when nobody is signed in,
   * when the identity changed while the mint was in flight, or when a
   * concurrent mint for a different target superseded this call.
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
   * Fail closed on a host scope change: drop the published credential,
   * cancel scheduled work, and invalidate in-flight mints. The identity
   * stays, because it belongs to the port, so a targeted re-mint can
   * follow at once. Identity changes fail closed through the port itself.
   */
  invalidate: () => void
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
  /**
   * Monotonic id taken by every started mint; a commit is allowed only for
   * the newest one. Target-agnostic on purpose — a slower mint for the old
   * workspace resolving after a switch must never revert it. Ports the
   * cloud store's unifiedRefreshRequestId guard.
   */
  let mintSequence = 0
  let inFlightMintId = 0

  function getSnapshot(): SessionSnapshot<TUser> {
    if (!currentUser) {
      return {
        phase: 'signed-out',
        user: null,
        session: undefined,
        settled: identitySettled
      }
    }
    if (credential) {
      return {
        phase: 'authenticated',
        user: currentUser,
        session: credential,
        settled: true
      }
    }
    if (failure) {
      return {
        phase: 'error',
        user: currentUser,
        session: undefined,
        failure,
        settled: true
      }
    }
    return {
      phase: 'minting',
      user: currentUser,
      session: undefined,
      settled: true
    }
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

  function persistCredential(
    session: AccountCredential,
    target: string | undefined
  ): void {
    safeWrite(JSON.stringify({ ...session, target }))
  }

  function safeClear(): void {
    try {
      storage.clear()
    } catch {
      void 0
    }
  }

  function readCached(
    uid: string
  ): { credential: AccountCredential; target: string | undefined } | undefined {
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
      credential: {
        token: result.data.token,
        expiresAt: result.data.expiresAt,
        uid: result.data.uid,
        workspace: result.data.workspace,
        role: result.data.role,
        permissions: result.data.permissions
      },
      target: result.data.target
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
      body:
        (options.workspaceId ?? clientOptions.workspaceId)
          ? { workspace_id: options.workspaceId ?? clientOptions.workspaceId }
          : {},
      fetchImpl:
        options.fetchImpl ?? clientOptions.fetchImpl ?? globalThis.fetch,
      signal: options.signal ?? clientOptions.signal,
      timeoutMs:
        options.timeoutMs ?? clientOptions.timeoutMs ?? DEFAULT_MINT_TIMEOUT_MS,
      now: () => options.now?.() ?? clientOptions.now?.() ?? Date.now()
    })
  }

  /**
   * A sign-out or a different user makes the running mint unjoinable: it
   * was started with the previous identity's token, and a caller arriving
   * after the event must mint for itself.
   */
  function abandonInFlight(): void {
    inFlight = undefined
    inFlightUid = undefined
    inFlightTarget = undefined
    inFlightForced = false
  }

  function sharedMint(
    user: AccountUser,
    options: SessionRequestOptions,
    forced: boolean
  ): MintHandle {
    const target = options.workspaceId ?? clientOptions.workspaceId
    if (
      inFlight !== undefined &&
      inFlightUid === user.uid &&
      inFlightTarget === target &&
      (!forced || inFlightForced)
    ) {
      return { mintId: inFlightMintId, response: inFlight }
    }
    inFlightUid = user.uid
    inFlightTarget = target
    inFlightForced = forced
    const mintId = ++mintSequence
    inFlightMintId = mintId
    const running = mint(user, options).finally(() => {
      if (inFlight !== running) return
      inFlight = undefined
      inFlightUid = undefined
      inFlightTarget = undefined
      inFlightForced = false
    })
    inFlight = running
    return { mintId, response: running }
  }

  function ensureCore(
    user: AccountUser,
    options: SessionRequestOptions
  ): MintHandle {
    const now = options.now?.() ?? clientOptions.now?.() ?? Date.now()
    const target = options.workspaceId ?? clientOptions.workspaceId
    // The first FRESH credential wins, storage before memory: a stale stored
    // record (a write that failed after a later mint) must not shadow the
    // live one, and a host whose storage is blocked must not pay a full
    // exchange on every read. Only a credential minted for this exact
    // target counts: a target-less read must never adopt a team-scoped
    // session, or the next scheduled refresh would quietly re-mint it as
    // personal.
    const stored = readCached(user.uid)
    const fresh = [
      stored !== undefined && stored.target === target
        ? stored.credential
        : undefined,
      credential?.uid === user.uid && credentialTarget === target
        ? credential
        : undefined
    ].find(
      (candidate) =>
        candidate !== undefined &&
        isCredentialFresh(candidate, now, freshMarginMs)
    )
    if (fresh) {
      return {
        mintId: mintSequence,
        response: Promise.resolve({ status: 'ok', session: fresh })
      }
    }
    return sharedMint(user, options, false)
  }

  function remintCore(
    user: AccountUser,
    options: SessionRequestOptions
  ): MintHandle {
    safeClear()
    return sharedMint(user, options, true)
  }

  const scheduler: ReturnType<typeof createRefreshScheduler> | undefined =
    clientOptions.refreshScheduler
      ? createRefreshScheduler(clientOptions.refreshScheduler, {
          now: () => clientOptions.now?.() ?? Date.now(),
          getCurrentUser: () => currentUser,
          getCredential: () => credential,
          captureGuards: () => ({
            epoch: identityEpoch,
            invalidation: invalidationEpoch
          }),
          guardsHold: (guards, user, mintId) =>
            mintId === mintSequence &&
            currentUser?.uid === user.uid &&
            identityEpoch === guards.epoch &&
            invalidationEpoch === guards.invalidation,
          mint: (user) =>
            sharedMint(user, { workspaceId: credentialTarget }, true),
          commitRefreshed: (session) => {
            credential = session
            failure = undefined
            persistCredential(session, credentialTarget)
            publish()
          },
          commitPermanentFailure: (permanent) => {
            credential = undefined
            credentialTarget = undefined
            failure = permanent
            safeClear()
            publish()
          },
          commitExpired: (expiring) => {
            if (credential !== expiring) return undefined
            credential = undefined
            credentialTarget = undefined
            const expired: SessionFailure = {
              status: 'error',
              code: 'TOKEN_EXCHANGE_FAILED'
            }
            failure = expired
            safeClear()
            publish()
            return expired
          },
          parseAdopted: (message) => {
            const parsed = CachedCredentialSchema.safeParse(message)
            if (!parsed.success) return undefined
            return {
              token: parsed.data.token,
              expiresAt: parsed.data.expiresAt,
              uid: parsed.data.uid,
              workspace: parsed.data.workspace,
              role: parsed.data.role,
              permissions: parsed.data.permissions
            }
          },
          commitAdopted: (next) => {
            // Adoption is a commit: it supersedes any in-flight mint of this
            // tab's own, exactly like a newer mint would.
            mintSequence += 1
            credential = next
            failure = undefined
            persistCredential(next, credentialTarget)
            publish()
          }
        } satisfies RefreshHost)
      : undefined

  async function refreshWith(
    core: (user: AccountUser, options: SessionRequestOptions) => MintHandle,
    requestedUser?: AccountUser,
    options: SessionRequestOptions = {}
  ): Promise<SessionResult | undefined> {
    const user = requestedUser ?? currentUser
    if (!user) return undefined

    const startEpoch = identityEpoch
    const startInvalidation = invalidationEpoch
    const startedSignedOut = currentUser === null
    const { mintId, response } = core(user, options)
    // A caller that joined an in-flight mint still gets its own signal
    // honored: the shared mint runs on, this caller stops waiting for it.
    let result: SessionResult
    try {
      result = options.signal
        ? await abortable(response, options.signal)
        : await response
    } catch {
      return { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    }
    if (invalidationEpoch !== startInvalidation) {
      return undefined
    }
    if (mintId !== mintSequence) {
      // The newest mint won, but when it committed a credential for this
      // caller's exact target, that credential answers the request — a lost
      // race is not a failure. A different target (or none) stays undefined.
      const requestedTarget = options.workspaceId ?? clientOptions.workspaceId
      if (
        credential !== undefined &&
        credential.uid === user.uid &&
        currentUser?.uid === user.uid &&
        requestedTarget === credentialTarget
      ) {
        return { status: 'ok', session: credential }
      }
      return undefined
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
      credentialTarget = options.workspaceId ?? clientOptions.workspaceId
      failure = undefined
      persistCredential(result.session, credentialTarget)
      scheduler?.armAfterCommit(
        result.session,
        options.now?.() ?? clientOptions.now?.() ?? Date.now()
      )
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
        scheduler?.stop()
        identitySettled = true
        if (!next || next.uid !== currentUser?.uid) abandonInFlight()
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
        scheduler?.stop()
        currentUser = null
        identitySettled = false
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
      scheduler?.stop()
      // A mint still running belongs to the scope being discarded; a caller
      // arriving after this must start its own rather than join it.
      inFlight = undefined
      inFlightUid = undefined
      inFlightTarget = undefined
      inFlightForced = false
      credential = undefined
      credentialTarget = undefined
      failure = undefined
      safeClear()
      publish()
    },
    clearStoredCredential() {
      safeClear()
    }
  }
}
