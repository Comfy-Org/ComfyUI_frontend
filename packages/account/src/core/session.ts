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
import { isPermanentSessionError } from './sessionContracts.js'

export type { AccountIdentity } from './identity.js'
export type {
  AccountCredential,
  AccountUser,
  CrossTabRefreshPort,
  MintHandle,
  RefreshSchedulerOptions,
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
  expiresAt: z.number(),
  uid: z.string(),
  /** The workspace target the credential was minted for; absent = personal. */
  target: z.string().optional()
})

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
  TOKEN_EXCHANGE_FAILED: 'Failed to authenticate with workspace: {error}'
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

  let inFlight:
    | {
        readonly promise: Promise<SessionResult>
        readonly uid: string
        readonly target: string | undefined
        readonly forced: boolean
        readonly mintId: number
      }
    | undefined
  /**
   * Monotonic id taken by every started mint; a commit is allowed only for
   * the newest one. Target-agnostic on purpose — a slower mint for the old
   * workspace resolving after a switch must never revert it. Ports the
   * cloud store's unifiedRefreshRequestId guard.
   */
  let mintSequence = 0

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

  /**
   * A sign-out or a different user makes the running mint unjoinable: it
   * was started with the previous identity's token, and a caller arriving
   * after the event must mint for itself.
   */
  function abandonInFlight(): void {
    inFlight = undefined
  }

  function sharedMint(
    user: AccountUser,
    options: SessionRequestOptions,
    forced: boolean
  ): MintHandle {
    const target = options.workspaceId ?? clientOptions.workspaceId
    if (
      inFlight !== undefined &&
      inFlight.uid === user.uid &&
      inFlight.target === target &&
      (!forced || inFlight.forced)
    ) {
      return { mintId: inFlight.mintId, response: inFlight.promise }
    }
    const mintId = ++mintSequence
    const running = mint(user, options).finally(() => {
      if (inFlight?.promise !== running) return
      inFlight = undefined
    })
    inFlight = { promise: running, uid: user.uid, target, forced, mintId }
    return { mintId, response: running }
  }

  function ensureCore(
    user: AccountUser,
    options: SessionRequestOptions
  ): MintHandle {
    const now = options.now?.() ?? clientOptions.now?.() ?? Date.now()
    const target = options.workspaceId ?? clientOptions.workspaceId
    // The live credential is authoritative; storage is recovery state, not a
    // competing source. Prefer a fresh in-memory credential for this exact
    // target and consult storage only when memory has none — expiry must not
    // override this (a rejected token can outlive its shorter-lived
    // replacement), and a target-less read must never adopt a team session.
    const stored = readCached(user.uid)
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
            const mismatch = targetMismatch(session, credentialTarget)
            if (mismatch) {
              credential = undefined
              credentialTarget = undefined
              failure = mismatch
              safeClear()
              publish()
              return mismatch
            }
            credential = session
            failure = undefined
            persistCredential(session, credentialTarget)
            publish()
            return undefined
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
      const requestedTarget = options.workspaceId ?? clientOptions.workspaceId
      const mismatch = targetMismatch(result.session, requestedTarget)
      if (mismatch) {
        credential = undefined
        credentialTarget = undefined
        failure = mismatch
        scheduler?.stop()
        safeClear()
        publish()
        return mismatch
      }
      credential = result.session
      credentialTarget = requestedTarget
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
      if (isPermanentSessionError(result.code)) {
        // A caller-initiated permanent failure must retire the armed scheduler
        // and target too, or its old timer could resurrect the dead session.
        scheduler?.stop()
        credentialTarget = undefined
        safeClear()
      }
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
        // A same-uid re-auth must not adopt a mint started under the prior identity.
        abandonInFlight()
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
