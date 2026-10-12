/**
 * The session's authoritative state and its only commit boundary. Effects
 * come back in the order the client must run them: persist before arming
 * the scheduler, publish last, so a host reacting to a snapshot never reads
 * state a later step would still change.
 */
import type {
  AccountCredential,
  AccountUser,
  SessionFailure
} from './sessionContracts.js'
import { isPermanentSessionError } from './sessionContracts.js'

export interface SessionState<TUser extends AccountUser = AccountUser> {
  readonly user: TUser | null
  readonly identitySettled: boolean
  readonly credential: AccountCredential | undefined
  readonly credentialTarget: string | undefined
  readonly failure: SessionFailure | undefined
  /**
   * The result the winning mint published, so a caller joining that same mint
   * returns it instead of running the commit/publication path a second time.
   */
  readonly committedMint:
    | { readonly mintId: number; readonly session: AccountCredential }
    | undefined
  /**
   * Bumped on every identity event so a mint can tell "the listener has not
   * settled yet" (the legitimate popup path) from "an identity event
   * happened while I was in flight" (must invalidate).
   */
  readonly identityEpoch: number
  readonly invalidationEpoch: number
  /**
   * Monotonic id taken by every started mint; a commit is allowed only for
   * the newest one. Target-agnostic on purpose — a slower mint for the old
   * workspace resolving after a switch must never revert it. Ports the
   * cloud store's unifiedRefreshRequestId guard.
   */
  readonly mintSequence: number
}

export function initialSessionState<
  TUser extends AccountUser = AccountUser
>(): SessionState<TUser> {
  return {
    user: null,
    identitySettled: false,
    credential: undefined,
    credentialTarget: undefined,
    failure: undefined,
    committedMint: undefined,
    identityEpoch: 0,
    invalidationEpoch: 0,
    mintSequence: 0
  }
}

export type SessionEvent<TUser extends AccountUser = AccountUser> =
  | { readonly type: 'identity-changed'; readonly user: TUser | null }
  | { readonly type: 'identity-detached' }
  | { readonly type: 'invalidated' }
  | { readonly type: 'mint-started' }
  | {
      readonly type: 'mint-committed'
      readonly origin: 'caller'
      readonly session: AccountCredential
      readonly target: string | undefined
      readonly mintId: number
    }
  | {
      readonly type: 'mint-committed'
      readonly origin: 'scheduler'
      readonly session: AccountCredential
      readonly mintId: number
    }
  | {
      readonly type: 'mint-rejected'
      readonly origin: 'caller'
      readonly failure: SessionFailure
      readonly preserveCredentialOnTransientFailure: boolean
    }
  | {
      readonly type: 'mint-rejected'
      readonly origin: 'scheduler'
      readonly failure: SessionFailure
    }
  | { readonly type: 'credential-adopted'; readonly session: AccountCredential }
  | {
      readonly type: 'credential-expired'
      readonly expiring: AccountCredential
    }

export type SessionEffect =
  | {
      readonly type: 'persist'
      readonly session: AccountCredential
      readonly target: string | undefined
    }
  | { readonly type: 'armScheduler'; readonly session: AccountCredential }
  | { readonly type: 'clearStorage' }
  | { readonly type: 'stopScheduler' }
  | { readonly type: 'abandonInFlight' }
  | { readonly type: 'publish' }

export interface SessionTransition<TUser extends AccountUser = AccountUser> {
  readonly state: SessionState<TUser>
  readonly effects: readonly SessionEffect[]
}

const clearStorage: SessionEffect = { type: 'clearStorage' }
const stopScheduler: SessionEffect = { type: 'stopScheduler' }
const abandonInFlight: SessionEffect = { type: 'abandonInFlight' }
const publish: SessionEffect = { type: 'publish' }

type EventOf<
  TUser extends AccountUser,
  TType extends SessionEvent<TUser>['type']
> = Extract<SessionEvent<TUser>, { type: TType }>

function dropSession<TUser extends AccountUser>(
  state: SessionState<TUser>
): SessionState<TUser> {
  return {
    ...state,
    credential: undefined,
    credentialTarget: undefined,
    failure: undefined
  }
}

function applyIdentityChanged<TUser extends AccountUser>(
  state: SessionState<TUser>,
  event: EventOf<TUser, 'identity-changed'>
): SessionTransition<TUser> {
  return {
    state: {
      ...dropSession(state),
      user: event.user,
      identitySettled: true,
      identityEpoch: state.identityEpoch + 1
    },
    // A sign-out or a different user makes the running mint unjoinable: it
    // was started with the previous identity's token, and a caller arriving
    // after the event must mint for itself. A same-uid re-auth must not
    // adopt it either.
    effects:
      event.user === null
        ? [stopScheduler, abandonInFlight, clearStorage, publish]
        : [stopScheduler, abandonInFlight, publish]
  }
}

function applyIdentityDetached<TUser extends AccountUser>(
  state: SessionState<TUser>
): SessionTransition<TUser> {
  return {
    state: {
      ...dropSession(state),
      user: null,
      identitySettled: false,
      identityEpoch: state.identityEpoch + 1
    },
    effects: [stopScheduler, publish]
  }
}

function applyInvalidated<TUser extends AccountUser>(
  state: SessionState<TUser>
): SessionTransition<TUser> {
  // A mint still running belongs to the scope being discarded; a caller
  // arriving after this must start its own rather than join it.
  return {
    state: {
      ...dropSession(state),
      invalidationEpoch: state.invalidationEpoch + 1
    },
    effects: [stopScheduler, abandonInFlight, clearStorage, publish]
  }
}

function applyMintStarted<TUser extends AccountUser>(
  state: SessionState<TUser>
): SessionTransition<TUser> {
  return {
    state: { ...state, mintSequence: state.mintSequence + 1 },
    effects: []
  }
}

function applyMintCommitted<TUser extends AccountUser>(
  state: SessionState<TUser>,
  event: EventOf<TUser, 'mint-committed'>
): SessionTransition<TUser> {
  const target =
    event.origin === 'caller' ? event.target : state.credentialTarget
  const persist: SessionEffect = {
    type: 'persist',
    session: event.session,
    target
  }
  return {
    state: {
      ...state,
      credential: event.session,
      credentialTarget: target,
      committedMint: { mintId: event.mintId, session: event.session },
      failure: undefined
    },
    effects:
      event.origin === 'caller'
        ? [persist, { type: 'armScheduler', session: event.session }, publish]
        : [persist, publish]
  }
}

function applySchedulerRejection<TUser extends AccountUser>(
  state: SessionState<TUser>,
  failure: SessionFailure
): SessionTransition<TUser> {
  return {
    state: { ...dropSession(state), failure },
    effects: [clearStorage, publish]
  }
}

function applyCallerRejection<TUser extends AccountUser>(
  state: SessionState<TUser>,
  event: EventOf<TUser, 'mint-rejected'> & { readonly origin: 'caller' }
): SessionTransition<TUser> {
  const permanent = isPermanentSessionError(event.failure.code)
  if (
    !permanent &&
    event.preserveCredentialOnTransientFailure &&
    state.credential !== undefined
  ) {
    return { state, effects: [] }
  }
  if (!permanent) {
    return {
      state: { ...state, credential: undefined, failure: event.failure },
      effects: [publish]
    }
  }
  // A caller-initiated permanent failure must retire the armed scheduler
  // and target too, or its old timer could resurrect the dead session.
  return {
    state: { ...dropSession(state), failure: event.failure },
    effects: [stopScheduler, clearStorage, publish]
  }
}

function applyMintRejected<TUser extends AccountUser>(
  state: SessionState<TUser>,
  event: EventOf<TUser, 'mint-rejected'>
): SessionTransition<TUser> {
  return event.origin === 'scheduler'
    ? applySchedulerRejection(state, event.failure)
    : applyCallerRejection(state, event)
}

function applyCredentialAdopted<TUser extends AccountUser>(
  state: SessionState<TUser>,
  event: EventOf<TUser, 'credential-adopted'>
): SessionTransition<TUser> {
  // Adoption is a commit: it supersedes any in-flight mint of this
  // tab's own, exactly like a newer mint would.
  return {
    state: {
      ...state,
      mintSequence: state.mintSequence + 1,
      credential: event.session,
      failure: undefined
    },
    effects: [
      {
        type: 'persist',
        session: event.session,
        target: state.credentialTarget
      },
      publish
    ]
  }
}

function applyCredentialExpired<TUser extends AccountUser>(
  state: SessionState<TUser>,
  event: EventOf<TUser, 'credential-expired'>
): SessionTransition<TUser> {
  if (state.credential !== event.expiring) return { state, effects: [] }
  return {
    state: {
      ...dropSession(state),
      failure: { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    },
    effects: [clearStorage, publish]
  }
}

export function transition<TUser extends AccountUser>(
  state: SessionState<TUser>,
  event: SessionEvent<TUser>
): SessionTransition<TUser> {
  switch (event.type) {
    case 'identity-changed':
      return applyIdentityChanged(state, event)
    case 'identity-detached':
      return applyIdentityDetached(state)
    case 'invalidated':
      return applyInvalidated(state)
    case 'mint-started':
      return applyMintStarted(state)
    case 'mint-committed':
      return applyMintCommitted(state, event)
    case 'mint-rejected':
      return applyMintRejected(state, event)
    case 'credential-adopted':
      return applyCredentialAdopted(state, event)
    case 'credential-expired':
      return applyCredentialExpired(state, event)
  }
}

export interface MintAttempt {
  readonly mintId: number
  /** Awaited another owner's in-flight mint instead of starting its own. */
  readonly joined: boolean
  readonly explicitUser: boolean
  readonly userUid: string
  readonly requestedTarget: string | undefined
  readonly startEpoch: number
  readonly startInvalidation: number
  readonly startedSignedOut: boolean
}

export type MintVerdict =
  | { readonly verdict: 'commit' }
  | { readonly verdict: 'reuse'; readonly session: AccountCredential }
  | { readonly verdict: 'superseded' }

const SUPERSEDED: MintVerdict = { verdict: 'superseded' }

function supersededByInvalidation<TUser extends AccountUser>(
  state: SessionState<TUser>,
  attempt: MintAttempt
): boolean {
  return state.invalidationEpoch !== attempt.startInvalidation
}

// The newest mint won, but when it committed a credential for this
// caller's exact target, that credential answers the request — a lost
// race is not a failure. A different target (or none) stays undefined.
function lostRace<TUser extends AccountUser>(
  state: SessionState<TUser>,
  attempt: MintAttempt
): MintVerdict | undefined {
  if (attempt.mintId === state.mintSequence) return undefined
  const answered =
    state.credential !== undefined &&
    state.credential.uid === attempt.userUid &&
    state.user?.uid === attempt.userUid &&
    attempt.requestedTarget === state.credentialTarget
  return answered ? { verdict: 'reuse', session: state.credential } : SUPERSEDED
}

function crossedIdentityEvent<TUser extends AccountUser>(
  state: SessionState<TUser>,
  attempt: MintAttempt
): boolean {
  return state.identityEpoch !== attempt.startEpoch
}

// The one mint allowed to cross an identity event: an explicit-user
// mint started while signed out, for the user the port then
// delivered (the popup path) as the single event since. Everything else
// was minted for an identity that is gone, even when the uid matches again.
function popupSettled<TUser extends AccountUser>(
  state: SessionState<TUser>,
  attempt: MintAttempt
): boolean {
  return (
    attempt.explicitUser &&
    attempt.startedSignedOut &&
    state.identityEpoch === attempt.startEpoch + 1 &&
    state.user?.uid === attempt.userUid
  )
}

// The explicit-user bypass is the popup path, valid only before the
// identity port has ever fired; a settled null identity blocks it.
function userMismatchBlocksCommit<TUser extends AccountUser>(
  state: SessionState<TUser>,
  attempt: MintAttempt
): boolean {
  return (
    state.user?.uid !== attempt.userUid &&
    (!attempt.explicitUser || state.user !== null || state.identitySettled)
  )
}

function joinerReuse<TUser extends AccountUser>(
  state: SessionState<TUser>,
  attempt: MintAttempt
): MintVerdict | undefined {
  return attempt.joined &&
    state.committedMint !== undefined &&
    state.committedMint.mintId === attempt.mintId &&
    state.credential === state.committedMint.session
    ? { verdict: 'reuse', session: state.committedMint.session }
    : undefined
}

export function arbitrateMint<TUser extends AccountUser>(
  state: SessionState<TUser>,
  attempt: MintAttempt
): MintVerdict {
  if (supersededByInvalidation(state, attempt)) return SUPERSEDED
  const raced = lostRace(state, attempt)
  if (raced) return raced
  const stale = crossedIdentityEvent(state, attempt)
    ? !popupSettled(state, attempt)
    : userMismatchBlocksCommit(state, attempt)
  if (stale) return SUPERSEDED
  return joinerReuse(state, attempt) ?? { verdict: 'commit' }
}

export function scheduledMintHolds<TUser extends AccountUser>(
  state: SessionState<TUser>,
  guards: { readonly epoch: number; readonly invalidation: number },
  userUid: string,
  mintId: number
): boolean {
  return (
    mintId === state.mintSequence &&
    state.user?.uid === userUid &&
    state.identityEpoch === guards.epoch &&
    state.invalidationEpoch === guards.invalidation
  )
}
