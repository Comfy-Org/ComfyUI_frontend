/**
 * The session-backed identity source: boots a site from `GET /auth/session`
 * and follows the server's answer. It keeps no record of past sessions, and
 * the remembered provider login is an opaque port, so no provider leaks in.
 */
import type {
  WebSession,
  WebSessionFailure,
  WebSessionResult
} from './sessionContracts.js'
import type { WebSessionOptions } from './webSession.js'
import { createWebSession, readWebSession } from './webSession.js'

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

export type WebSessionIdentityState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'api_key' }
  | {
      readonly phase: 'reading' | 'retry_wait' | 'restoring'
      readonly failures: number
    }
  | { readonly phase: 'signed_in'; readonly session: WebSession }
  | { readonly phase: 'signed_out'; readonly outcome: SignedOutOutcome }

export type WebSessionIdentityEvent =
  | { readonly type: 'boot' }
  | {
      readonly type: 'read_answered' | 'restore_answered'
      readonly result: WebSessionResult
      readonly rememberedUserId: string | null
    }
  | { readonly type: 'proof_missing' | 'proof_errored' }
  | { readonly type: 'retry_due' }

export type WebSessionIdentityEffect =
  | { readonly type: 'read' }
  | { readonly type: 'restore' }
  | { readonly type: 'schedule_retry'; readonly failures: number }
  | { readonly type: 'sign_out_locally' }
  | { readonly type: 'report'; readonly outcome: WebSessionBootOutcome }

export interface WebSessionIdentityTransition {
  readonly state: WebSessionIdentityState
  readonly effects: readonly WebSessionIdentityEffect[]
}

const read: WebSessionIdentityEffect = { type: 'read' }
const signOutLocally: WebSessionIdentityEffect = { type: 'sign_out_locally' }

function settleSignedIn(
  session: WebSession,
  rememberedUserId: string | null,
  outcome: 'signed_in' | 'restored'
): WebSessionIdentityTransition {
  const loginDiffers =
    rememberedUserId !== null && rememberedUserId !== session.user.id
  return {
    state: { phase: 'signed_in', session },
    effects: [
      ...(loginDiffers ? [signOutLocally] : []),
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
    effects: [{ type: 'restore' }]
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

/** Pure: an event that means nothing in the current phase changes nothing. */
export function transitionWebSessionIdentity(
  state: WebSessionIdentityState,
  event: WebSessionIdentityEvent
): WebSessionIdentityTransition {
  const unchanged = { state, effects: [] }
  switch (event.type) {
    case 'boot':
      return state.phase === 'idle'
        ? {
            state: { phase: 'reading', failures: 0 },
            effects: [read]
          }
        : unchanged
    case 'read_answered':
      return state.phase === 'reading'
        ? applyReadAnswered(
            state.failures,
            event.result,
            event.rememberedUserId
          )
        : unchanged
    case 'restore_answered':
      return state.phase === 'restoring'
        ? applyRestoreAnswered(
            state.failures,
            event.result,
            event.rememberedUserId
          )
        : unchanged
    case 'proof_missing':
      return state.phase === 'restoring'
        ? settleSignedOut('restore_failed')
        : unchanged
    case 'proof_errored':
      return state.phase === 'restoring'
        ? waitToRetry(state.failures + 1)
        : unchanged
    case 'retry_due':
      return state.phase === 'retry_wait'
        ? { state: { ...state, phase: 'reading' }, effects: [read] }
        : unchanged
  }
}

export type ScheduleRetry = (run: () => void, delayMs: number) => () => void

export interface WebSessionIdentityOptions {
  readonly session: WebSessionOptions
  readonly principal: WebSessionPrincipal
  /** The site reporting the boot, e.g. `https://www.comfy.org`. */
  readonly origin: string
  readonly onBootstrap?: (event: WebSessionBootstrapEvent) => void
  readonly schedule?: ScheduleRetry
  readonly retryBaseMs?: number
  readonly retryMaxMs?: number
}

export interface WebSessionIdentity {
  getState: () => WebSessionIdentityState
  /** Delivers the current state at once, then every change. */
  subscribe: (listener: (state: WebSessionIdentityState) => void) => () => void
  /** Starts the boot; a no-op unless idle. */
  boot: () => void
  /** Cancels the retry, ignores answers in flight, and returns to idle. */
  dispose: () => void
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
  const listeners = new Set<(state: WebSessionIdentityState) => void>()
  let state: WebSessionIdentityState = { phase: 'idle' }
  let generation = 0
  let cancelRetry: (() => void) | undefined

  function dispatch(event: WebSessionIdentityEvent): void {
    const next = transitionWebSessionIdentity(state, event)
    if (next.state === state) return
    state = next.state
    listeners.forEach((listener) => listener(state))
    next.effects.forEach(run)
  }

  async function answer(
    started: number,
    type: 'read_answered' | 'restore_answered',
    request: () => Promise<WebSessionResult>
  ): Promise<void> {
    const result = await request()
    const rememberedUserId = await login.currentUserId().catch(() => null)
    if (started === generation) dispatch({ type, result, rememberedUserId })
  }

  async function restore(started: number): Promise<void> {
    const proof = await login.getProof().then(
      (value) => ({ value }),
      () => undefined
    )
    if (started !== generation) return
    if (proof === undefined) return dispatch({ type: 'proof_errored' })
    const { value } = proof
    if (value === null) return dispatch({ type: 'proof_missing' })
    await answer(started, 'restore_answered', () =>
      createWebSession(options.session, async () => value)
    )
  }

  function run(effect: WebSessionIdentityEffect): void {
    switch (effect.type) {
      case 'read':
        void answer(generation, 'read_answered', () =>
          readWebSession(options.session)
        )
        return
      case 'restore':
        void restore(generation)
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
      case 'report':
        options.onBootstrap?.({
          outcome: effect.outcome,
          origin: options.origin
        })
    }
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
    boot: () => dispatch({ type: 'boot' }),
    dispose: () => {
      generation += 1
      cancelRetry?.()
      cancelRetry = undefined
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
