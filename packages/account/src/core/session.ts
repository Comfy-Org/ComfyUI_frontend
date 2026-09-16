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
import type {
  AccountCredential,
  AccountUser,
  MintHandle,
  RefreshSchedulerOptions,
  SessionErrorCode,
  SessionFailure,
  SessionResult
} from './sessionContracts.js'
import type { SessionEffect, SessionEvent } from './sessionState.js'
import {
  arbitrateMint,
  initialSessionState,
  scheduledMintHolds,
  transition
} from './sessionState.js'

export type { AccountIdentity } from './identity.js'
export type {
  AccountCredential,
  AccountUser,
  CrossTabRefreshPort,
  MintHandle,
  RefreshSchedulerOptions,
  ScheduledRefreshReport,
  SessionErrorCode,
  SessionFailure,
  SessionRefreshOutcome,
  SessionResult
} from './sessionContracts.js'
export { isPermanentSessionError } from './sessionContracts.js'

/** The generated contract for POST /api/auth/token, never a local copy of it. */
const CachedCredentialSchema = CredentialResponseSchema.omit({
  expires_at: true
}).extend({
  // Storage and broadcast are untrusted boundaries: an empty token can never
  // authorize and a non-finite expiry can never lapse, so neither is a session.
  token: z.string().min(1),
  expiresAt: z.number().finite(),
  uid: z.string(),
  /** The workspace target the credential was minted for; absent = personal. */
  target: z.string().optional()
})

/**
 * The session error codes, keys only. Hosts own the copy (the cloud app's
 * workspaceAuth.errors.*); the package ships the vocabulary so a host can
 * narrow an arbitrary error code to one it has a line for. Exhaustive by
 * type: a new SessionErrorCode is a compile error until it is listed here.
 */
export const SESSION_ERROR_CODES: Readonly<Record<SessionErrorCode, true>> = {
  NOT_AUTHENTICATED: true,
  INVALID_FIREBASE_TOKEN: true,
  ACCESS_DENIED: true,
  WORKSPACE_NOT_FOUND: true,
  TOKEN_EXCHANGE_FAILED: true
}

export { SESSION_TELEMETRY_EVENT } from '../telemetry.js'

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

export interface SessionClientOptions extends SessionRequestOptions {
  readonly exchangeUrl: string
  readonly storage: CredentialStorage
  readonly freshMarginMs?: number
  readonly refreshScheduler?: RefreshSchedulerOptions
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

export interface AttachIdentityOptions {
  /**
   * When false, an identity event sets the user and publishes without
   * starting a warm-up mint — for hosts that drive every mint explicitly.
   */
  readonly autoMint?: boolean
}

export interface SessionClient<TUser extends AccountUser = AccountUser> {
  /** @deprecated Transitional Pinia-adapter seam; package-owned identity replaces it (FE-2171, PoC #16639). */
  attachIdentity: (
    identity: AccountIdentity<TUser>,
    options?: AttachIdentityOptions
  ) => () => void
  getSnapshot: () => SessionSnapshot<TUser>
  subscribe: (
    listener: (snapshot: SessionSnapshot<TUser>) => void
  ) => () => void
  /** The current credential's token, uid-guarded and withheld once expired (zero margin); no `freshMarginMs` or proactive-refresh promise. */
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

  let state = initialSessionState<TUser>()
  let detachCurrent: (() => void) | undefined
  const listeners = new Set<(snapshot: SessionSnapshot<TUser>) => void>()

  let inFlight:
    | {
        readonly promise: Promise<SessionResult>
        readonly uid: string
        readonly target: string | undefined
        readonly forced: boolean
        readonly mintId: number
      }
    | undefined

  function getSnapshot(): SessionSnapshot<TUser> {
    const { user, identitySettled, credential, failure } = state
    if (!user) {
      return identitySettled
        ? { phase: 'signed-out', user: null, session: undefined }
        : { phase: 'pending', user: null, session: undefined }
    }
    if (credential) {
      return { phase: 'authenticated', user, session: credential }
    }
    if (failure) {
      return { phase: 'error', user, session: undefined, failure }
    }
    return { phase: 'minting', user, session: undefined }
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

  // The exchange echoes the requested workspace on success (a non-member 404s),
  // so a scope mismatch is a backend regression to fail closed on — shared by
  // the direct commit and the scheduled-refresh commit.
  function targetMismatch(
    session: AccountCredential,
    target: string | undefined
  ): SessionFailure | undefined {
    return target !== undefined && session.workspace.id !== target
      ? { status: 'error', code: 'ACCESS_DENIED' }
      : undefined
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
    const workspaceId = options.workspaceId ?? clientOptions.workspaceId
    if (workspaceId === '') {
      // An explicit empty id is an invalid selection, not personal; fail
      // closed instead of silently minting a personal-scoped session.
      return Promise.resolve({ status: 'error', code: 'WORKSPACE_NOT_FOUND' })
    }
    return exchangeToken(user, {
      exchangeUrl,
      body: workspaceId ? { workspace_id: workspaceId } : {},
      fetchImpl:
        options.fetchImpl ?? clientOptions.fetchImpl ?? globalThis.fetch,
      signal: options.signal ?? clientOptions.signal,
      timeoutMs:
        options.timeoutMs ?? clientOptions.timeoutMs ?? DEFAULT_MINT_TIMEOUT_MS,
      now: () => options.now?.() ?? clientOptions.now?.() ?? Date.now()
    })
  }

  function hostNow(): number {
    return clientOptions.now?.() ?? Date.now()
  }

  function withCredential(
    use: (session: AccountCredential, target: string | undefined) => void
  ): void {
    if (state.credential !== undefined) {
      use(state.credential, state.credentialTarget)
    }
  }

  function runEffect(effect: SessionEffect, now: () => number): void {
    switch (effect) {
      case 'persist':
        withCredential(persistCredential)
        return
      case 'clearStorage':
        safeClear()
        return
      case 'stopScheduler':
        scheduler?.stop()
        return
      case 'armScheduler':
        withCredential((session) => scheduler?.armAfterCommit(session, now()))
        return
      case 'abandonInFlight':
        // A sign-out or a different user makes the running mint unjoinable: it
        // was started with the previous identity's token, and a caller arriving
        // after the event must mint for itself.
        inFlight = undefined
        return
      case 'publish':
        publish()
        return
    }
  }

  function commit(
    event: SessionEvent<TUser>,
    now: () => number = hostNow
  ): boolean {
    const next = transition(state, event)
    const changed = next.state !== state
    state = next.state
    for (const effect of next.effects) runEffect(effect, now)
    return changed
  }

  // `joined` marks a caller that awaits another owner's in-flight mint rather
  // than starting or cache-serving its own, so it can defer to that owner's
  // commit instead of re-running the publication path.
  type MintDispatch = MintHandle & { readonly joined: boolean }

  function sharedMint(
    user: AccountUser,
    options: SessionRequestOptions,
    forced: boolean
  ): MintDispatch {
    const target = options.workspaceId ?? clientOptions.workspaceId
    if (
      inFlight !== undefined &&
      inFlight.uid === user.uid &&
      inFlight.target === target &&
      (!forced || inFlight.forced)
    ) {
      return {
        mintId: inFlight.mintId,
        response: inFlight.promise,
        joined: true
      }
    }
    commit({ type: 'mint-started' })
    const mintId = state.mintSequence
    const running = mint(user, options).finally(() => {
      if (inFlight?.promise !== running) return
      inFlight = undefined
    })
    inFlight = { promise: running, uid: user.uid, target, forced, mintId }
    return { mintId, response: running, joined: false }
  }

  function ensureCore(
    user: AccountUser,
    options: SessionRequestOptions
  ): MintDispatch {
    const now = options.now?.() ?? clientOptions.now?.() ?? Date.now()
    const target = options.workspaceId ?? clientOptions.workspaceId
    // The live credential is authoritative; storage is recovery state, not a
    // competing source. Prefer a fresh in-memory credential for this exact
    // target and consult storage only when memory has none — expiry must not
    // override this (a rejected token can outlive its shorter-lived
    // replacement), and a target-less read must never adopt a team session.
    const stored = readCached(user.uid)
    const { credential, credentialTarget } = state
    const fresh = [
      credential?.uid === user.uid && credentialTarget === target
        ? credential
        : undefined,
      stored !== undefined && stored.target === target
        ? stored.credential
        : undefined
    ].find(
      (candidate): candidate is AccountCredential =>
        candidate !== undefined &&
        isCredentialFresh(candidate, now, freshMarginMs)
    )
    if (fresh) {
      return {
        mintId: state.mintSequence,
        response: Promise.resolve({ status: 'ok', session: fresh }),
        joined: false
      }
    }
    return sharedMint(user, options, false)
  }

  function remintCore(
    user: AccountUser,
    options: SessionRequestOptions
  ): MintDispatch {
    safeClear()
    return sharedMint(user, options, true)
  }

  const scheduler: ReturnType<typeof createRefreshScheduler> | undefined =
    clientOptions.refreshScheduler
      ? createRefreshScheduler(clientOptions.refreshScheduler, {
          now: hostNow,
          getCurrentUser: () => state.user,
          getCredential: () => state.credential,
          captureGuards: () => ({
            epoch: state.identityEpoch,
            invalidation: state.invalidationEpoch
          }),
          guardsHold: (guards, user, mintId) =>
            scheduledMintHolds(state, guards, user.uid, mintId),
          mint: (user) =>
            sharedMint(user, { workspaceId: state.credentialTarget }, true),
          commitRefreshed: (session) => {
            const mismatch = targetMismatch(session, state.credentialTarget)
            if (mismatch) {
              commit({
                type: 'mint-rejected',
                origin: 'scheduler',
                failure: mismatch,
                preserveCredentialOnTransientFailure: false
              })
              return mismatch
            }
            commit({ type: 'mint-committed', origin: 'scheduler', session })
            return undefined
          },
          commitPermanentFailure: (failure) => {
            commit({
              type: 'mint-rejected',
              origin: 'scheduler',
              failure,
              preserveCredentialOnTransientFailure: false
            })
          },
          commitExpired: (expiring) =>
            commit({ type: 'credential-expired', expiring })
              ? state.failure
              : undefined,
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
          commitAdopted: (session) => {
            commit({ type: 'credential-adopted', session })
          }
        } satisfies RefreshHost)
      : undefined

  async function refreshWith(
    core: (user: AccountUser, options: SessionRequestOptions) => MintDispatch,
    requestedUser?: AccountUser,
    options: SessionRequestOptions = {}
  ): Promise<SessionResult | undefined> {
    const user = requestedUser ?? state.user
    if (!user) return undefined

    const startEpoch = state.identityEpoch
    const startInvalidation = state.invalidationEpoch
    const startedSignedOut = state.user === null
    const requestedTarget = options.workspaceId ?? clientOptions.workspaceId
    const { mintId, response, joined } = core(user, options)
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
    const arbitration = arbitrateMint(state, {
      mintId,
      joined,
      explicitUser: requestedUser !== undefined,
      userUid: user.uid,
      requestedTarget,
      startEpoch,
      startInvalidation,
      startedSignedOut
    })
    if (arbitration.verdict === 'superseded') return undefined
    if (arbitration.verdict === 'reuse') {
      return { status: 'ok', session: arbitration.session }
    }
    const rejectMint = (failure: SessionFailure): SessionFailure => {
      commit({
        type: 'mint-rejected',
        origin: 'caller',
        failure,
        preserveCredentialOnTransientFailure:
          options.preserveCredentialOnTransientFailure === true
      })
      return failure
    }
    if (result.status !== 'ok') return rejectMint(result)
    const mismatch = targetMismatch(result.session, requestedTarget)
    if (mismatch) return rejectMint(mismatch)
    commit(
      {
        type: 'mint-committed',
        origin: 'caller',
        session: result.session,
        target: requestedTarget,
        mintId
      },
      () => options.now?.() ?? hostNow()
    )
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
        commit({ type: 'identity-changed', user: next })
        if (next && attachOptions?.autoMint !== false) {
          void refreshWith(ensureCore, next)
        }
      })
      const detach = () => {
        if (!active) return
        active = false
        detachCurrent = undefined
        unsubscribe()
        commit({ type: 'identity-detached' })
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
      const { user, credential } = state
      return credential !== undefined &&
        user?.uid === credential.uid &&
        isCredentialFresh(credential, hostNow(), 0)
        ? credential.token
        : undefined
    },
    ensureFresh: (requestedUser, options) =>
      refreshWith(ensureCore, requestedUser, options),
    remint: (requestedUser, options) =>
      refreshWith(remintCore, requestedUser, options),
    invalidate() {
      commit({ type: 'invalidated' })
    },
    clearStoredCredential() {
      safeClear()
    }
  }
}
