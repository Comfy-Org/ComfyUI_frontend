/**
 * The session-backed identity source: boots a site from `GET /auth/session`
 * and follows the server's answer. It keeps no record of past sessions, and
 * the remembered provider login is an opaque port, so no provider leaks in.
 */
import { z } from 'zod'

import type {
  CrossTabRefreshPort,
  WebSession,
  WebSessionCommandResult,
  WebSessionFailure,
  WebSessionResult
} from './sessionContracts.js'
import type { WebSessionOptions } from './webSession.js'
import {
  createWebSession,
  deleteWebSession,
  readWebSession
} from './webSession.js'

export interface RememberedLogin {
  /** The Comfy user id of the login this browser remembers, or null. */
  currentUserId: () => Promise<string | null>
  /** Null when the provider has no usable login; a throw is transient. */
  getProof: () => Promise<string | null>
  signOutLocally: () => Promise<void>
}

export type WebSessionPrincipal =
  | { readonly kind: 'account'; readonly rememberedLogin: RememberedLogin }
  | { readonly kind: 'api_key' }

export type WebSessionBootOutcome =
  | 'signed_in'
  | 'restored'
  | 'signed_out'
  | 'revoked'
  | 'restore_failed'

export interface WebSessionBootstrapEvent {
  readonly outcome: WebSessionBootOutcome
  readonly origin: string
}

type SignedOutOutcome = Exclude<WebSessionBootOutcome, 'signed_in' | 'restored'>

/** The account this tab holds changed under it, or went away. */
export type WebSessionAccountChange =
  | { readonly reason: 'user_changed'; readonly session: WebSession }
  | { readonly reason: 'signed_out'; readonly outcome: SignedOutOutcome }

export type WebSessionIdentityState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'api_key' }
  | {
      readonly phase: 'reading' | 'retry_wait' | 'restoring'
      readonly failures: number
    }
  | { readonly phase: 'signed_in'; readonly session: WebSession }
  | { readonly phase: 'signed_out'; readonly outcome: SignedOutOutcome }

/** Only a sibling's sign-in is news to a tab that has signed out. */
export type SessionObservedFrom =
  | 'this_tab'
  | 'sibling_heartbeat'
  | 'sibling_sign_in'
  | 'sibling_sign_out'

export type WebSessionIdentityEvent =
  | { readonly type: 'boot' }
  | {
      readonly type: 'read_answered' | 'restore_answered'
      readonly result: WebSessionResult
      readonly rememberedUserId: string | null
    }
  | { readonly type: 'proof_missing' | 'proof_errored' | 'login_errored' }
  | { readonly type: 'retry_due' }
  /** A heartbeat answer, this tab's or one a sibling tab published. */
  | {
      readonly type: 'session_observed'
      readonly from: SessionObservedFrom
      readonly result: WebSessionResult
      readonly rememberedUserId: string | null
    }
  | { readonly type: 'session_created'; readonly session: WebSession }
  | { readonly type: 'sign_out_requested' }

export type WebSessionIdentityEffect =
  | { readonly type: 'read' }
  | { readonly type: 'restore'; readonly expectedUserId: string }
  | { readonly type: 'schedule_retry'; readonly failures: number }
  | { readonly type: 'sign_out_locally' }
  | { readonly type: 'report'; readonly outcome: WebSessionBootOutcome }
  | {
      readonly type: 'account_changed'
      readonly change: WebSessionAccountChange
    }
  | { readonly type: 'report_signed_out_remotely' }

export interface WebSessionIdentityTransition {
  readonly state: WebSessionIdentityState
  readonly effects: readonly WebSessionIdentityEffect[]
}

const read: WebSessionIdentityEffect = { type: 'read' }
const signOutLocally: WebSessionIdentityEffect = { type: 'sign_out_locally' }

function signOutDifferentLogin(
  session: WebSession,
  rememberedUserId: string | null
): WebSessionIdentityEffect[] {
  return rememberedUserId !== null && rememberedUserId !== session.user.id
    ? [signOutLocally]
    : []
}

function settleSignedIn(
  session: WebSession,
  rememberedUserId: string | null,
  outcome: 'signed_in' | 'restored'
): WebSessionIdentityTransition {
  return {
    state: { phase: 'signed_in', session },
    effects: [
      ...signOutDifferentLogin(session, rememberedUserId),
      { type: 'report', outcome }
    ]
  }
}

function settleSignedOut(
  outcome: SignedOutOutcome
): WebSessionIdentityTransition {
  return {
    state: { phase: 'signed_out', outcome },
    effects: [
      ...(outcome === 'revoked' ? [signOutLocally] : []),
      { type: 'report', outcome }
    ]
  }
}

function waitToRetry(failures: number): WebSessionIdentityTransition {
  return {
    state: { phase: 'retry_wait', failures },
    effects: [{ type: 'schedule_retry', failures }]
  }
}

function isNoLiveSession(failure: WebSessionFailure): boolean {
  return failure.code === 'NO_SESSION' || failure.code === 'SESSION_EXPIRED'
}

function applyReadAnswered(
  failures: number,
  result: WebSessionResult,
  rememberedUserId: string | null
): WebSessionIdentityTransition {
  if (result.status === 'ok') {
    return settleSignedIn(result.session, rememberedUserId, 'signed_in')
  }
  if (result.retryable) return waitToRetry(failures + 1)
  if (result.code === 'SESSION_REVOKED') return settleSignedOut('revoked')
  if (!isNoLiveSession(result)) return settleSignedOut('signed_out')
  if (rememberedUserId === null) return settleSignedOut('signed_out')
  return {
    state: { phase: 'restoring', failures },
    effects: [{ type: 'restore', expectedUserId: rememberedUserId }]
  }
}

function applyRestoreAnswered(
  failures: number,
  result: WebSessionResult,
  rememberedUserId: string | null
): WebSessionIdentityTransition {
  if (result.status === 'ok') {
    return settleSignedIn(result.session, rememberedUserId, 'restored')
  }
  if (result.retryable) return waitToRetry(failures + 1)
  if (result.code === 'SESSION_REVOKED') return settleSignedOut('revoked')
  return settleSignedOut('restore_failed')
}

function leaveAccount(
  outcome: SignedOutOutcome,
  effects: readonly WebSessionIdentityEffect[] = []
): WebSessionIdentityTransition {
  return {
    state: { phase: 'signed_out', outcome },
    effects: [
      ...effects,
      { type: 'account_changed', change: { reason: 'signed_out', outcome } }
    ]
  }
}

function replaceSession(
  held: WebSession,
  session: WebSession,
  effects: readonly WebSessionIdentityEffect[] = []
): WebSessionIdentityTransition {
  const state: WebSessionIdentityState = { phase: 'signed_in', session }
  if (session.user.id === held.user.id) return { state, effects: [] }
  return {
    state,
    effects: [
      ...effects,
      { type: 'account_changed', change: { reason: 'user_changed', session } }
    ]
  }
}

/** A read never signs out on doubt: only revoked or no live session does. */
function observeWhileSignedIn(
  state: Extract<WebSessionIdentityState, { phase: 'signed_in' }>,
  result: WebSessionResult,
  rememberedUserId: string | null,
  restored: boolean,
  ownRead: boolean
): WebSessionIdentityTransition {
  if (result.status === 'ok') {
    return replaceSession(
      state.session,
      result.session,
      signOutDifferentLogin(result.session, rememberedUserId)
    )
  }
  if (result.retryable) return { state, effects: [] }
  if (result.code === 'SESSION_REVOKED') {
    return leaveAccount(
      'revoked',
      ownRead
        ? [signOutLocally, { type: 'report_signed_out_remotely' }]
        : [signOutLocally]
    )
  }
  if (restored) return leaveAccount('restore_failed')
  if (!isNoLiveSession(result)) return { state, effects: [] }
  if (rememberedUserId === null) return leaveAccount('signed_out')
  return {
    state,
    effects: [{ type: 'restore', expectedUserId: rememberedUserId }]
  }
}

function transitionSignedIn(
  state: Extract<WebSessionIdentityState, { phase: 'signed_in' }>,
  event: WebSessionIdentityEvent
): WebSessionIdentityTransition {
  switch (event.type) {
    case 'session_observed':
      return observeWhileSignedIn(
        state,
        event.result,
        event.rememberedUserId,
        false,
        event.from === 'this_tab'
      )
    case 'restore_answered':
      return observeWhileSignedIn(
        state,
        event.result,
        event.rememberedUserId,
        true,
        true
      )
    case 'session_created':
      return replaceSession(state.session, event.session)
    case 'proof_missing':
      return leaveAccount('restore_failed')
    case 'sign_out_requested':
      return leaveAccount('signed_out', [signOutLocally])
    default:
      return { state, effects: [] }
  }
}

type SettlingState = Exclude<
  WebSessionIdentityState,
  { readonly phase: 'idle' | 'api_key' | 'signed_in' }
>

function transitionRestoring(
  state: Extract<SettlingState, { readonly failures: number }>,
  event: WebSessionIdentityEvent
): WebSessionIdentityTransition {
  switch (event.type) {
    case 'restore_answered':
      return applyRestoreAnswered(
        state.failures,
        event.result,
        event.rememberedUserId
      )
    case 'proof_missing':
      return settleSignedOut('restore_failed')
    case 'proof_errored':
    case 'login_errored':
      return waitToRetry(state.failures + 1)
    default:
      return { state, effects: [] }
  }
}

function transitionBoot(
  state: SettlingState,
  event: WebSessionIdentityEvent
): WebSessionIdentityTransition {
  switch (state.phase) {
    case 'reading':
      if (event.type === 'login_errored') return waitToRetry(state.failures + 1)
      return event.type === 'read_answered'
        ? applyReadAnswered(
            state.failures,
            event.result,
            event.rememberedUserId
          )
        : { state, effects: [] }
    case 'retry_wait':
      return event.type === 'retry_due'
        ? { state: { ...state, phase: 'reading' }, effects: [read] }
        : { state, effects: [] }
    case 'restoring':
      return transitionRestoring(state, event)
    default:
      return { state, effects: [] }
  }
}

function transitionSettling(
  state: SettlingState,
  event: WebSessionIdentityEvent
): WebSessionIdentityTransition {
  switch (event.type) {
    case 'session_observed': {
      const { result } = event
      const adoptable =
        state.phase === 'retry_wait' ||
        (state.phase === 'signed_out' && event.from === 'sibling_sign_in')
      if (result.status !== 'ok' || !adoptable) return { state, effects: [] }
      return {
        state: { phase: 'signed_in', session: result.session },
        effects: signOutDifferentLogin(result.session, event.rememberedUserId)
      }
    }
    case 'session_created':
      return {
        state: { phase: 'signed_in', session: event.session },
        effects: []
      }
    case 'sign_out_requested':
      return state.phase === 'signed_out'
        ? { state, effects: [] }
        : {
            state: { phase: 'signed_out', outcome: 'signed_out' },
            effects: [signOutLocally]
          }
    default:
      return transitionBoot(state, event)
  }
}

/** Pure: an event that means nothing in the current phase changes nothing. */
export function transitionWebSessionIdentity(
  state: WebSessionIdentityState,
  event: WebSessionIdentityEvent
): WebSessionIdentityTransition {
  switch (state.phase) {
    case 'idle':
      return event.type === 'boot'
        ? { state: { phase: 'reading', failures: 0 }, effects: [read] }
        : { state, effects: [] }
    case 'api_key':
      return { state, effects: [] }
    case 'signed_in':
      return transitionSignedIn(state, event)
    default:
      return transitionSettling(state, event)
  }
}

export type ScheduleRetry = (run: () => void, delayMs: number) => () => void

export interface VisibilityPort {
  isVisible: () => boolean
  onChange: (listener: (visible: boolean) => void) => () => void
}

export interface WebSessionHeartbeatOptions {
  readonly visibility: VisibilityPort
  /** Without it every tab reads for itself. */
  readonly crossTab?: CrossTabRefreshPort<WebSessionSharedMessage>
  readonly intervalMs?: number
}

export interface WebSessionIdentityOptions {
  readonly session: WebSessionOptions
  readonly principal: WebSessionPrincipal
  /** The site reporting the boot, e.g. `https://www.comfy.org`. */
  readonly origin: string
  readonly onBootstrap?: (event: WebSessionBootstrapEvent) => void
  /** Telemetry for `session_signed_out_remotely`. */
  readonly onSignedOutRemotely?: (event: { readonly origin: string }) => void
  /** The host drops pending actions and user-scoped state here. */
  readonly onAccountChanged?: (
    change: WebSessionAccountChange & { readonly epoch: number }
  ) => void
  readonly heartbeat?: WebSessionHeartbeatOptions
  readonly schedule?: ScheduleRetry
  readonly retryBaseMs?: number
  readonly retryMaxMs?: number
}

export interface WebSessionIdentity {
  getState: () => WebSessionIdentityState
  /** Delivers the current state at once, then every change. */
  subscribe: (listener: (state: WebSessionIdentityState) => void) => () => void
  /** Starts the boot and the heartbeat; a no-op unless idle. */
  boot: () => void
  /** Only after an interactive sign-in; a token refresh must never call it. */
  signedIn: (getProof: () => Promise<string>) => Promise<WebSessionResult>
  signOut: () => Promise<WebSessionCommandResult>
  /** Changes with the account; an answer started under an older epoch is stale. */
  getEpoch: () => number
  /** Cancels timers, ignores answers in flight, and returns to idle. */
  dispose: () => void
}

const HEARTBEAT_KEY = '@comfyorg/account-core web-session heartbeat'
const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000

const zSharedResult = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    session: z.object({
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string().optional(),
        emailVerified: z.boolean(),
        signInProvider: z.string().optional()
      }),
      csrfToken: z.string(),
      expiresAt: z.number(),
      absoluteExpiresAt: z.number()
    })
  }),
  z.object({
    status: z.literal('error'),
    code: z.literal('SESSION_REVOKED'),
    retryable: z.literal(false)
  })
])

const zSharedMessage = z.object({
  from: z.enum(['heartbeat', 'sign_in', 'sign_out']),
  result: zSharedResult
})

type SharedFrom = z.infer<typeof zSharedMessage>['from']

/** What one tab of a site tells its siblings, and why. */
export interface WebSessionSharedMessage {
  readonly from: SharedFrom
  readonly result: WebSessionResult
}

const revoked: WebSessionResult = {
  status: 'error',
  code: 'SESSION_REVOKED',
  retryable: false
}

const scheduleWithTimer: ScheduleRetry = (run, delayMs) => {
  const timer = setTimeout(run, delayMs)
  return () => clearTimeout(timer)
}

function reportLocalSignOutFailure(error: unknown): void {
  console.warn('webSessionIdentity: local sign-out failed', error)
}

function createApiKeyIdentity(): WebSessionIdentity {
  const state: WebSessionIdentityState = { phase: 'api_key' }
  return {
    getState: () => state,
    subscribe: (listener) => {
      listener(state)
      return () => undefined
    },
    boot: () => undefined,
    signedIn: async () => ({
      status: 'error',
      code: 'SESSION_REQUEST_REFUSED',
      retryable: false
    }),
    signOut: async () => ({ status: 'ok' }),
    getEpoch: () => 0,
    dispose: () => undefined
  }
}

function createAccountIdentity(
  options: WebSessionIdentityOptions,
  login: RememberedLogin
): WebSessionIdentity {
  const schedule = options.schedule ?? scheduleWithTimer
  const retryBaseMs = options.retryBaseMs ?? 1000
  const retryMaxMs = options.retryMaxMs ?? 60_000
  const heartbeat = options.heartbeat
  const listeners = new Set<(state: WebSessionIdentityState) => void>()
  let state: WebSessionIdentityState = { phase: 'idle' }
  let epoch = 0
  let cancelRetry: (() => void) | undefined
  let cancelBeat: (() => void) | undefined
  let releaseLeadership: (() => void) | undefined
  let stopWatching: (() => void)[] = []

  function dispatch(event: WebSessionIdentityEvent): void {
    const next = transitionWebSessionIdentity(state, event)
    const changed = next.state !== state
    state = next.state
    next.effects.forEach(run)
    if (changed) listeners.forEach((listener) => listener(state))
    syncLeadership()
  }

  function publish(from: SharedFrom, result: WebSessionResult): void {
    heartbeat?.crossTab?.publishCredential(HEARTBEAT_KEY, { from, result })
  }

  type Answered =
    | { readonly type: 'read_answered' | 'restore_answered' }
    | { readonly type: 'session_observed'; readonly from: SessionObservedFrom }

  async function answer(
    started: number,
    answered: Answered,
    request: () => Promise<WebSessionResult>
  ): Promise<void> {
    const result = await request()
    const remembered = await login.currentUserId().then(
      (value) => ({ value }),
      () => undefined
    )
    if (started !== epoch) return
    if (remembered === undefined) return dispatch({ type: 'login_errored' })
    dispatch({ ...answered, result, rememberedUserId: remembered.value })
  }

  function beat(): void {
    const started = epoch
    const observed = { type: 'session_observed', from: 'this_tab' } as const
    void answer(started, observed, async () => {
      const result = await readWebSession(options.session)
      const shared = result.status === 'ok' || result.code === 'SESSION_REVOKED'
      if (shared && started === epoch) publish('heartbeat', result)
      return result
    })
  }

  function adopt(message: unknown): void {
    const parsed = zSharedMessage.safeParse(message)
    if (!parsed.success) return
    const { from, result } = parsed.data
    const observed = {
      type: 'session_observed',
      from: `sibling_${from}`
    } as const
    void answer(epoch, observed, async () => result)
  }

  function wantsBeat(): boolean {
    return (
      stopWatching.length > 0 &&
      state.phase === 'signed_in' &&
      heartbeat?.visibility.isVisible() === true
    )
  }

  function armBeat(): void {
    cancelBeat = schedule(() => {
      beat()
      armBeat()
    }, heartbeat?.intervalMs ?? HEARTBEAT_INTERVAL_MS)
  }

  function lead(): void {
    if (wantsBeat() && cancelBeat === undefined) armBeat()
  }

  function syncLeadership(): void {
    const wanted = wantsBeat()
    if (wanted && releaseLeadership === undefined) {
      const port = heartbeat?.crossTab
      if (port) {
        releaseLeadership = port.requestLeadership(HEARTBEAT_KEY, lead)
      } else {
        releaseLeadership = () => undefined
        lead()
      }
    } else if (!wanted && releaseLeadership !== undefined) {
      releaseLeadership()
      releaseLeadership = undefined
      cancelBeat?.()
      cancelBeat = undefined
    }
  }

  function watch(): void {
    if (heartbeat === undefined) return
    const { visibility, crossTab } = heartbeat
    stopWatching = [
      visibility.onChange((visible) => {
        if (visible && state.phase === 'signed_in') beat()
        syncLeadership()
      }),
      ...(crossTab ? [crossTab.onCredential(HEARTBEAT_KEY, adopt)] : [])
    ]
  }

  async function restore(
    started: number,
    expectedUserId: string
  ): Promise<void> {
    const proof = await login.getProof().then(
      (value) => ({ value }),
      () => undefined
    )
    if (started !== epoch) return
    if (proof === undefined) return dispatch({ type: 'proof_errored' })
    const { value } = proof
    if (value === null) return dispatch({ type: 'proof_missing' })
    await answer(started, { type: 'restore_answered' }, () =>
      createWebSession(options.session, async () => value, { expectedUserId })
    )
  }

  function run(effect: WebSessionIdentityEffect): void {
    switch (effect.type) {
      case 'read':
        void answer(epoch, { type: 'read_answered' }, () =>
          readWebSession(options.session)
        )
        return
      case 'restore':
        void restore(epoch, effect.expectedUserId)
        return
      case 'schedule_retry':
        cancelRetry = schedule(
          () => {
            cancelRetry = undefined
            dispatch({ type: 'retry_due' })
          },
          Math.min(retryBaseMs * 2 ** (effect.failures - 1), retryMaxMs)
        )
        return
      case 'sign_out_locally':
        login.signOutLocally().catch(reportLocalSignOutFailure)
        return
      default:
        notify(effect)
    }
  }

  function notify(effect: WebSessionIdentityEffect): void {
    switch (effect.type) {
      case 'report':
        options.onBootstrap?.({
          outcome: effect.outcome,
          origin: options.origin
        })
        return
      case 'account_changed':
        epoch += 1
        options.onAccountChanged?.({ ...effect.change, epoch })
        return
      case 'report_signed_out_remotely':
        options.onSignedOutRemotely?.({ origin: options.origin })
    }
  }

  function stopHeartbeat(): void {
    stopWatching.forEach((stop) => stop())
    stopWatching = []
    syncLeadership()
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      listener(state)
      return () => {
        listeners.delete(listener)
      }
    },
    boot: () => {
      if (state.phase !== 'idle') return
      watch()
      dispatch({ type: 'boot' })
    },
    signedIn: async (getProof) => {
      const result = await createWebSession(options.session, getProof)
      if (result.status !== 'ok') return result
      dispatch({ type: 'session_created', session: result.session })
      publish('sign_in', result)
      return result
    },
    signOut: async () => {
      dispatch({ type: 'sign_out_requested' })
      const result = await deleteWebSession(options.session)
      if (result.status === 'ok') publish('sign_out', revoked)
      return result
    },
    getEpoch: () => epoch,
    dispose: () => {
      epoch += 1
      cancelRetry?.()
      cancelRetry = undefined
      stopHeartbeat()
      state = { phase: 'idle' }
      listeners.forEach((listener) => listener(state))
    }
  }
}

/** Inert until `boot()`: constructing it sends no request and arms no timer. */
export function createWebSessionIdentity(
  options: WebSessionIdentityOptions
): WebSessionIdentity {
  return options.principal.kind === 'api_key'
    ? createApiKeyIdentity()
    : createAccountIdentity(options, options.principal.rememberedLogin)
}
