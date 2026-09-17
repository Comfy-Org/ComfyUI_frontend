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
import type { CredentialStorage } from './credentialCache.js'
import {
  DEFAULT_FRESH_MARGIN_MS,
  createCredentialCache,
  decodeAdopted,
  isCredentialFresh,
  selectFreshCredential
} from './credentialCache.js'
import type { AccountIdentity } from './identity.js'
import { isAccountIdentity } from './identity.js'
import { abortable, exchangeToken } from './exchange.js'
import type { MintDispatch } from './mintCoordinator.js'
import { createMintCoordinator } from './mintCoordinator.js'
import type { RefreshHost } from './refreshScheduler.js'
import { createRefreshScheduler } from './refreshScheduler.js'
import type {
  AccountCredential,
  AccountUser,
  RefreshSchedulerOptions,
  SessionErrorCode,
  SessionFailure,
  SessionResult
} from './sessionContracts.js'
import type {
  SessionEffect,
  SessionEvent,
  SessionTransition
} from './sessionState.js'
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
export type { CredentialStorage } from './credentialCache.js'
export { isCredentialFresh } from './credentialCache.js'

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
  /** Applies to the identity passed at construction; see `AttachIdentityOptions.autoMint`. */
  readonly autoMint?: boolean
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
  /** @deprecated Transitional Pinia-adapter seam; pass the identity as `createSessionClient`'s second argument instead (FE-2171, PoC #16639). */
  attachIdentity: (
    identity: AccountIdentity<TUser>,
    options?: AttachIdentityOptions
  ) => () => void
  /**
   * Detaches the current identity; the persisted credential stays until
   * `clearStoredCredential`. Not terminal, like a detach: an explicit-user
   * mint issued after `dispose()` still commits and can re-arm the scheduler
   * and cross-tab lease, so dispose and then stop calling the client.
   */
  dispose: () => void
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

const DEFAULT_MINT_TIMEOUT_MS = 15_000

/**
 * The status→code mapping from `requestToken`: 401/403/404 are permanent
 * failures with their own codes; everything else — 5xx, network failure,
 * abort, unparseable body — collapses to TOKEN_EXCHANGE_FAILED, matching
 * production's default branch.
 */
export function createSessionClient<TUser extends AccountUser = AccountUser>(
  clientOptions: SessionClientOptions,
  identity?: AccountIdentity<TUser>
): SessionClient<TUser> {
  const {
    exchangeUrl,
    storage,
    freshMarginMs = DEFAULT_FRESH_MARGIN_MS
  } = clientOptions

  let state = initialSessionState<TUser>()
  let detachCurrent: (() => void) | undefined
  const listeners = new Set<(snapshot: SessionSnapshot<TUser>) => void>()
  const cache = createCredentialCache(storage)
  const mints = createMintCoordinator()

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

  function runEffect(effect: SessionEffect, now: () => number): void {
    switch (effect.type) {
      case 'persist':
        cache.write(effect.session, effect.target)
        return
      case 'clearStorage':
        cache.clear()
        return
      case 'stopScheduler':
        scheduler?.stop()
        return
      case 'armScheduler':
        scheduler?.armAfterCommit(effect.session, now())
        return
      case 'abandonInFlight':
        mints.abandon()
        return
      case 'publish':
        publish()
        return
    }
  }

  function commit(
    event: SessionEvent<TUser>,
    now: () => number = hostNow
  ): SessionTransition<TUser> {
    const next = transition(state, event)
    state = next.state
    for (const effect of next.effects) runEffect(effect, now)
    return next
  }

  function sharedMint(
    user: AccountUser,
    options: SessionRequestOptions,
    forced: boolean
  ): MintDispatch {
    const target = options.workspaceId ?? clientOptions.workspaceId
    return mints.dispatch(user.uid, target, forced, () => {
      const { mintSequence } = commit({ type: 'mint-started' }).state
      return { mintId: mintSequence, response: mint(user, options) }
    })
  }

  function ensureCore(
    user: AccountUser,
    options: SessionRequestOptions
  ): MintDispatch {
    const now = options.now?.() ?? clientOptions.now?.() ?? Date.now()
    const target = options.workspaceId ?? clientOptions.workspaceId
    const fresh = selectFreshCredential(
      [
        () => ({
          credential: state.credential,
          target: state.credentialTarget
        }),
        () => cache.read(user.uid)
      ],
      user.uid,
      target,
      now,
      freshMarginMs
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
    cache.clear()
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
          commitRefreshed: (session, mintId) => {
            const mismatch = targetMismatch(session, state.credentialTarget)
            if (mismatch) {
              commit({
                type: 'mint-rejected',
                origin: 'scheduler',
                failure: mismatch
              })
              return mismatch
            }
            commit({
              type: 'mint-committed',
              origin: 'scheduler',
              session,
              mintId
            })
            return undefined
          },
          commitPermanentFailure: (failure) => {
            commit({ type: 'mint-rejected', origin: 'scheduler', failure })
          },
          commitExpired: (expiring) =>
            state.credential === expiring
              ? commit({ type: 'credential-expired', expiring }).state.failure
              : undefined,
          parseAdopted: decodeAdopted,
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
    return commitCallerMint(result, mintId, requestedTarget, options)
  }

  function commitCallerMint(
    result: SessionResult,
    mintId: number,
    requestedTarget: string | undefined,
    options: SessionRequestOptions
  ): SessionResult {
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

  function subscribeIdentity(
    port: AccountIdentity<TUser>,
    autoMint: boolean
  ): () => void {
    if (!isAccountIdentity(port)) {
      throw new Error(
        'the session client needs the identity from @comfyorg/account-core/firebase (or /testing)'
      )
    }
    detachCurrent?.()
    let unsubscribe: () => void = () => undefined
    const detach = () => {
      if (detachCurrent !== detach) return
      detachCurrent = undefined
      unsubscribe()
      commit({ type: 'identity-detached' })
    }
    detachCurrent = detach
    unsubscribe = port.onUserChanged((next) => {
      if (detachCurrent !== detach) return
      commit({ type: 'identity-changed', user: next })
      if (detachCurrent === detach && next && autoMint) {
        void refreshWith(ensureCore, next)
      }
    })
    if (detachCurrent !== detach) unsubscribe()
    return detach
  }

  if (identity) subscribeIdentity(identity, clientOptions.autoMint !== false)

  return {
    attachIdentity: (port, attachOptions) =>
      subscribeIdentity(port, attachOptions?.autoMint !== false),
    dispose() {
      detachCurrent?.()
    },
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      // The immediate replay runs host code; if it throws, drop the listener
      // so a failed subscribe leaves nothing behind to publish to.
      try {
        listener(getSnapshot())
      } catch (error) {
        listeners.delete(listener)
        throw error
      }
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
      cache.clear()
    }
  }
}
