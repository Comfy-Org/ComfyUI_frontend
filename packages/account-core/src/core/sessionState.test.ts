import { describe, expect, it } from 'vitest'

import { credential, testUser } from './__fixtures__/sessionFakes.js'
import type {
  MintAttempt,
  MintVerdict,
  SessionEffect,
  SessionEvent,
  SessionState
} from './sessionState.js'
import {
  arbitrateMint,
  initialSessionState,
  scheduledMintHolds,
  transition
} from './sessionState.js'

const user = testUser('uid-1')
const otherUser = testUser('uid-2')
const live = credential('live-jwt')
const minted = credential('minted-jwt')
const permanentFailure = { status: 'error', code: 'ACCESS_DENIED' } as const
const transientFailure = {
  status: 'error',
  code: 'TOKEN_EXCHANGE_FAILED',
  httpStatus: 503
} as const

const signedIn: SessionState = {
  user,
  identitySettled: true,
  credential: live,
  credentialTarget: 'ws-1',
  failure: undefined,
  committedMint: { mintId: 3, session: live },
  identityEpoch: 2,
  invalidationEpoch: 1,
  mintSequence: 3
}

const cleared = {
  credential: undefined,
  credentialTarget: undefined,
  failure: undefined
}

const stopScheduler: SessionEffect = { type: 'stopScheduler' }
const abandonInFlight: SessionEffect = { type: 'abandonInFlight' }
const clearStorage: SessionEffect = { type: 'clearStorage' }
const publish: SessionEffect = { type: 'publish' }

describe('transition', () => {
  it.for<{
    name: string
    state: SessionState
    event: SessionEvent
    expected: { state: SessionState; effects: SessionEffect[] }
  }>([
    {
      name: 'an identity event installs the user, settles identity and drops the session',
      state: { ...signedIn, identitySettled: false },
      event: { type: 'identity-changed', user: otherUser },
      expected: {
        state: {
          ...signedIn,
          ...cleared,
          user: otherUser,
          identitySettled: true,
          identityEpoch: 3
        },
        effects: [stopScheduler, abandonInFlight, publish]
      }
    },
    {
      name: 'a null identity event also clears storage',
      state: signedIn,
      event: { type: 'identity-changed', user: null },
      expected: {
        state: { ...signedIn, ...cleared, user: null, identityEpoch: 3 },
        effects: [stopScheduler, abandonInFlight, clearStorage, publish]
      }
    },
    {
      name: 'detach re-pends the identity, keeps storage and leaves the in-flight mint alone',
      state: signedIn,
      event: { type: 'identity-detached' },
      expected: {
        state: {
          ...signedIn,
          ...cleared,
          user: null,
          identitySettled: false,
          identityEpoch: 3
        },
        effects: [stopScheduler, publish]
      }
    },
    {
      name: 'invalidation drops the session and storage but keeps the identity',
      state: signedIn,
      event: { type: 'invalidated' },
      expected: {
        state: { ...signedIn, ...cleared, invalidationEpoch: 2 },
        effects: [stopScheduler, abandonInFlight, clearStorage, publish]
      }
    },
    {
      name: 'starting a mint takes the next sequence id and touches nothing else',
      state: signedIn,
      event: { type: 'mint-started' },
      expected: { state: { ...signedIn, mintSequence: 4 }, effects: [] }
    },
    {
      name: 'a caller commit installs the credential for its target, persists, arms, then publishes',
      state: { ...signedIn, credential: undefined, failure: transientFailure },
      event: {
        type: 'mint-committed',
        origin: 'caller',
        session: minted,
        target: 'ws-9',
        mintId: 3
      },
      expected: {
        state: {
          ...signedIn,
          credential: minted,
          credentialTarget: 'ws-9',
          committedMint: { mintId: 3, session: minted }
        },
        effects: [
          { type: 'persist', session: minted, target: 'ws-9' },
          { type: 'armScheduler', session: minted },
          publish
        ]
      }
    },
    {
      name: 'a popup commit lands while nobody is signed in',
      state: initialSessionState(),
      event: {
        type: 'mint-committed',
        origin: 'caller',
        session: minted,
        target: undefined,
        mintId: 1
      },
      expected: {
        state: {
          ...initialSessionState(),
          credential: minted,
          committedMint: { mintId: 1, session: minted }
        },
        effects: [
          { type: 'persist', session: minted, target: undefined },
          { type: 'armScheduler', session: minted },
          publish
        ]
      }
    },
    {
      name: 'a scheduled commit keeps the target, records its mint id and leaves arming to the scheduler',
      state: { ...signedIn, mintSequence: 7 },
      event: {
        type: 'mint-committed',
        origin: 'scheduler',
        session: minted,
        mintId: 7
      },
      expected: {
        state: {
          ...signedIn,
          mintSequence: 7,
          credential: minted,
          committedMint: { mintId: 7, session: minted }
        },
        effects: [{ type: 'persist', session: minted, target: 'ws-1' }, publish]
      }
    },
    {
      name: 'a caller-initiated permanent failure retires target, storage and the scheduler',
      state: signedIn,
      event: {
        type: 'mint-rejected',
        origin: 'caller',
        failure: permanentFailure,
        preserveCredentialOnTransientFailure: false
      },
      expected: {
        state: { ...signedIn, ...cleared, failure: permanentFailure },
        effects: [stopScheduler, clearStorage, publish]
      }
    },
    {
      name: 'a permanent failure commits even when transient preservation was requested',
      state: signedIn,
      event: {
        type: 'mint-rejected',
        origin: 'caller',
        failure: permanentFailure,
        preserveCredentialOnTransientFailure: true
      },
      expected: {
        state: { ...signedIn, ...cleared, failure: permanentFailure },
        effects: [stopScheduler, clearStorage, publish]
      }
    },
    {
      name: 'a scheduled failure clears storage without stopping the scheduler mid-run',
      state: signedIn,
      event: {
        type: 'mint-rejected',
        origin: 'scheduler',
        failure: permanentFailure
      },
      expected: {
        state: { ...signedIn, ...cleared, failure: permanentFailure },
        effects: [clearStorage, publish]
      }
    },
    {
      name: 'a transient failure drops the credential but keeps target, storage and the scheduler',
      state: signedIn,
      event: {
        type: 'mint-rejected',
        origin: 'caller',
        failure: transientFailure,
        preserveCredentialOnTransientFailure: false
      },
      expected: {
        state: {
          ...signedIn,
          credential: undefined,
          failure: transientFailure
        },
        effects: [publish]
      }
    },
    {
      name: 'transient preservation has nothing to preserve without a live credential',
      state: { ...signedIn, credential: undefined },
      event: {
        type: 'mint-rejected',
        origin: 'caller',
        failure: transientFailure,
        preserveCredentialOnTransientFailure: true
      },
      expected: {
        state: {
          ...signedIn,
          credential: undefined,
          failure: transientFailure
        },
        effects: [publish]
      }
    },
    {
      name: 'adopting a sibling credential supersedes the in-flight mint and keeps the target',
      state: { ...signedIn, failure: transientFailure },
      event: { type: 'credential-adopted', session: minted },
      expected: {
        state: { ...signedIn, mintSequence: 4, credential: minted },
        effects: [{ type: 'persist', session: minted, target: 'ws-1' }, publish]
      }
    },
    {
      name: 'adoption leaves the last committed mint untouched',
      state: { ...signedIn, committedMint: { mintId: 2, session: live } },
      event: { type: 'credential-adopted', session: minted },
      expected: {
        state: {
          ...signedIn,
          mintSequence: 4,
          credential: minted,
          committedMint: { mintId: 2, session: live }
        },
        effects: [{ type: 'persist', session: minted, target: 'ws-1' }, publish]
      }
    },
    {
      name: 'expiry of the live credential fails closed and clears storage',
      state: signedIn,
      event: { type: 'credential-expired', expiring: live },
      expected: {
        state: {
          ...signedIn,
          ...cleared,
          failure: { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
        },
        effects: [clearStorage, publish]
      }
    }
  ])('$name', ({ state, event, expected }) => {
    const result = transition(state, event)

    expect(result.state).toEqual(expected.state)
    expect(result.effects).toEqual(expected.effects)
  })

  it.for<{ name: string; event: SessionEvent }>([
    {
      name: 'a caller commit',
      event: {
        type: 'mint-committed',
        origin: 'caller',
        session: minted,
        target: 'ws-1',
        mintId: 3
      }
    },
    {
      name: 'a scheduled commit',
      event: {
        type: 'mint-committed',
        origin: 'scheduler',
        session: minted,
        mintId: 3
      }
    },
    {
      name: 'an adoption',
      event: { type: 'credential-adopted', session: minted }
    }
  ])('$name installs the event credential itself, not a copy', ({ event }) => {
    expect(transition(signedIn, event).state.credential).toBe(minted)
  })

  it.for<{ name: string; state: SessionState; event: SessionEvent }>([
    {
      name: 'a preserved transient failure changes nothing and publishes nothing',
      state: signedIn,
      event: {
        type: 'mint-rejected',
        origin: 'caller',
        failure: transientFailure,
        preserveCredentialOnTransientFailure: true
      }
    },
    {
      name: 'an expiry for a credential that is no longer live, even an equal clone, is ignored',
      state: signedIn,
      event: { type: 'credential-expired', expiring: credential('live-jwt') }
    },
    {
      name: 'an expiry with no live credential is ignored',
      state: { ...signedIn, credential: undefined },
      event: { type: 'credential-expired', expiring: live }
    }
  ])('$name', ({ state, event }) => {
    const result = transition(state, event)

    expect(result.state).toBe(state)
    expect(result.effects).toEqual([])
  })
})

describe('arbitrateMint', () => {
  const attempt: MintAttempt = {
    mintId: 3,
    joined: false,
    explicitUser: false,
    userUid: 'uid-1',
    requestedTarget: 'ws-1',
    startEpoch: 2,
    startInvalidation: 1,
    startedSignedOut: false
  }

  it.for<{
    name: string
    state: SessionState
    attempt: MintAttempt
    verdict: MintVerdict
  }>([
    {
      name: 'the newest mint for the same user and target commits',
      state: signedIn,
      attempt,
      verdict: { verdict: 'commit' }
    },
    {
      name: 'an invalidation during the mint supersedes it',
      state: { ...signedIn, invalidationEpoch: 2 },
      attempt,
      verdict: { verdict: 'superseded' }
    },
    {
      name: 'a lost race for the exact target reuses the winner',
      state: { ...signedIn, mintSequence: 4 },
      attempt,
      verdict: { verdict: 'reuse', session: live }
    },
    {
      name: 'a lost race for a different target is superseded',
      state: { ...signedIn, mintSequence: 4 },
      attempt: { ...attempt, requestedTarget: 'ws-9' },
      verdict: { verdict: 'superseded' }
    },
    {
      name: 'a lost race whose winner belongs to another user is superseded',
      state: {
        ...signedIn,
        mintSequence: 4,
        credential: credential('other', { uid: 'uid-2' })
      },
      attempt,
      verdict: { verdict: 'superseded' }
    },
    {
      name: 'a lost race after the port switched users is superseded',
      state: { ...signedIn, mintSequence: 4, user: otherUser },
      attempt,
      verdict: { verdict: 'superseded' }
    },
    {
      name: 'a lost race with no credential committed is superseded',
      state: { ...signedIn, mintSequence: 4, credential: undefined },
      attempt,
      verdict: { verdict: 'superseded' }
    },
    {
      name: 'an explicit mint started signed-out crosses the identity event that delivered its user',
      state: { ...signedIn, identityEpoch: 3 },
      attempt: { ...attempt, explicitUser: true, startedSignedOut: true },
      verdict: { verdict: 'commit' }
    },
    {
      name: 'an implicit mint started signed-out never crosses an identity event',
      state: { ...signedIn, identityEpoch: 3 },
      attempt: { ...attempt, startedSignedOut: true },
      verdict: { verdict: 'superseded' }
    },
    {
      name: 'a popup mint that crossed two identity events is superseded even when the uid matches again',
      state: { ...signedIn, identityEpoch: 4 },
      attempt: { ...attempt, explicitUser: true, startedSignedOut: true },
      verdict: { verdict: 'superseded' }
    },
    {
      name: 'an explicit mint started signed-in never crosses an identity event',
      state: { ...signedIn, identityEpoch: 3 },
      attempt: { ...attempt, explicitUser: true },
      verdict: { verdict: 'superseded' }
    },
    {
      name: 'a popup mint is superseded when the port delivered a different user',
      state: { ...signedIn, identityEpoch: 3, user: otherUser },
      attempt: { ...attempt, explicitUser: true, startedSignedOut: true },
      verdict: { verdict: 'superseded' }
    },
    {
      name: 'an implicit mint is superseded once the port shows another user',
      state: { ...signedIn, user: otherUser },
      attempt,
      verdict: { verdict: 'superseded' }
    },
    {
      name: 'an explicit mint before the port ever fired commits',
      state: {
        ...initialSessionState(),
        identityEpoch: 2,
        invalidationEpoch: 1,
        mintSequence: 3
      },
      attempt: { ...attempt, explicitUser: true },
      verdict: { verdict: 'commit' }
    },
    {
      name: 'a settled null identity blocks the explicit-user bypass',
      state: {
        ...initialSessionState(),
        identitySettled: true,
        identityEpoch: 2,
        invalidationEpoch: 1,
        mintSequence: 3
      },
      attempt: { ...attempt, explicitUser: true },
      verdict: { verdict: 'superseded' }
    },
    {
      name: 'an explicit mint for a user other than the signed-in one is superseded',
      state: { ...signedIn, user: otherUser },
      attempt: { ...attempt, explicitUser: true },
      verdict: { verdict: 'superseded' }
    },
    {
      name: 'a joiner whose mint the owner already committed reuses that session',
      state: signedIn,
      attempt: { ...attempt, joined: true },
      verdict: { verdict: 'reuse', session: live }
    },
    {
      name: 'a joiner commits itself when the committed session was replaced since',
      state: { ...signedIn, credential: minted },
      attempt: { ...attempt, joined: true },
      verdict: { verdict: 'commit' }
    },
    {
      name: 'a joiner commits itself when the last commit was an older mint',
      state: { ...signedIn, committedMint: { mintId: 2, session: live } },
      attempt: { ...attempt, joined: true },
      verdict: { verdict: 'commit' }
    }
  ])('$name', ({ state, attempt, verdict }) => {
    const result = arbitrateMint(state, attempt)

    expect(result).toEqual(verdict)
    expect(result.verdict === 'reuse' && result.session).toBe(
      verdict.verdict === 'reuse' && verdict.session
    )
  })
})

describe('scheduledMintHolds', () => {
  const guards = { epoch: 2, invalidation: 1 }

  it.for<{ name: string; state: SessionState; holds: boolean }>([
    { name: 'nothing changed', state: signedIn, holds: true },
    {
      name: 'a newer mint started',
      state: { ...signedIn, mintSequence: 4 },
      holds: false
    },
    {
      name: 'the port switched users',
      state: { ...signedIn, user: otherUser },
      holds: false
    },
    {
      name: 'the identity re-delivered',
      state: { ...signedIn, identityEpoch: 3 },
      holds: false
    },
    {
      name: 'the host invalidated',
      state: { ...signedIn, invalidationEpoch: 2 },
      holds: false
    }
  ])('$name', ({ state, holds }) => {
    expect(scheduledMintHolds(state, guards, 'uid-1', 3)).toBe(holds)
  })
})
