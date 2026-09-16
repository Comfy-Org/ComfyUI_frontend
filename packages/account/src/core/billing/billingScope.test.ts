import { describe, expect, it, vi } from 'vitest'

import type { SessionClient, SessionSnapshot } from '../session.js'
import type { AccountCredential } from '../sessionContracts.js'
import type { BillingScope, BillingScopeSource } from './billingScope.js'
import {
  createBillingScopeTracker,
  sessionBillingScopeSource
} from './billingScope.js'

function credential(
  overrides: Partial<AccountCredential> = {}
): AccountCredential {
  return {
    token: 'workspace-jwt',
    expiresAt: Date.now() + 60 * 60 * 1000,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: ['workspace:read'],
    ...overrides
  }
}

function authenticated(session: AccountCredential): SessionSnapshot {
  return {
    phase: 'authenticated',
    user: { uid: session.uid, getIdToken: async () => 'id-token' },
    session
  }
}

const PENDING: SessionSnapshot = {
  phase: 'pending',
  user: null,
  session: undefined
}

const SIGNED_OUT: SessionSnapshot = {
  phase: 'signed-out',
  user: null,
  session: undefined
}

const MINTING: SessionSnapshot = {
  phase: 'minting',
  user: { uid: 'uid-1', getIdToken: async () => 'id-token' },
  session: undefined
}

const PERSONAL_SCOPE: BillingScope = {
  userId: 'uid-1',
  workspaceId: 'ws-1',
  role: 'owner'
}

function fakeSession(initial: SessionSnapshot) {
  let snapshot = initial
  const listeners = new Set<(next: SessionSnapshot) => void>()
  const fake: Pick<SessionClient, 'getSnapshot' | 'subscribe'> = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
  return {
    source: sessionBillingScopeSource(fake),
    moveTo(next: SessionSnapshot) {
      snapshot = next
      for (const listener of [...listeners]) listener(snapshot)
    }
  }
}

/** A scope source a host with no session client would supply. */
function fakeScopeSource(initial: BillingScope | undefined) {
  let scope = initial
  const listeners = new Set<() => void>()
  const source: BillingScopeSource = {
    getScope: () => scope,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
  return {
    source,
    moveTo(next: BillingScope | undefined) {
      scope = next
      for (const listener of [...listeners]) listener()
    }
  }
}

describe('sessionBillingScopeSource', () => {
  it.for([
    ['has not delivered an identity yet', PENDING, undefined],
    ['is signed out', SIGNED_OUT, undefined],
    ['is still minting a workspace credential', MINTING, undefined],
    [
      'is authenticated for a workspace',
      authenticated(credential()),
      PERSONAL_SCOPE
    ],
    [
      'is authenticated as a team member',
      authenticated(
        credential({
          uid: 'uid-2',
          workspace: { id: 'ws-2', name: 'Team', type: 'team' },
          role: 'member'
        })
      ),
      { userId: 'uid-2', workspaceId: 'ws-2', role: 'member' }
    ]
  ] as const)(
    'reports %s as %o',
    ([, snapshot, expected]: readonly [
      string,
      SessionSnapshot,
      BillingScope | undefined
    ]) => {
      const { source } = fakeSession(snapshot)

      expect(source.getScope()).toEqual(expected)
    }
  )

  it('reports the scope the session moved to', () => {
    const { source, moveTo } = fakeSession(authenticated(credential()))

    moveTo(
      authenticated(
        credential({ workspace: { id: 'ws-2', name: 'Team', type: 'team' } })
      )
    )

    expect(source.getScope()).toEqual({
      userId: 'uid-1',
      workspaceId: 'ws-2',
      role: 'owner'
    })
  })
})

describe('createBillingScopeTracker', () => {
  it('captures the scope the source reports', () => {
    const { source } = fakeScopeSource(PERSONAL_SCOPE)
    const tracker = createBillingScopeTracker(source, vi.fn())

    expect(tracker.capture()).toEqual({
      scope: PERSONAL_SCOPE,
      generation: 0
    })
  })

  it('captures nothing while the source reports no scope', () => {
    const { source } = fakeScopeSource(undefined)
    const tracker = createBillingScopeTracker(source, vi.fn())

    expect(tracker.capture()).toBeUndefined()
  })

  it('keeps a capture current when the source republishes the same scope', () => {
    const { source, moveTo } = fakeScopeSource(PERSONAL_SCOPE)
    const onChange = vi.fn()
    const tracker = createBillingScopeTracker(source, onChange)
    const captured = tracker.capture()

    moveTo({ ...PERSONAL_SCOPE })

    expect(onChange).not.toHaveBeenCalled()
    expect(captured !== undefined && tracker.isCurrent(captured)).toBe(true)
  })

  it.for([
    ['user', { ...PERSONAL_SCOPE, userId: 'uid-2' }],
    ['workspace', { ...PERSONAL_SCOPE, workspaceId: 'ws-2' }],
    ['role', { ...PERSONAL_SCOPE, role: 'member' }],
    ['signed-out', undefined]
  ] as const)(
    'supersedes a capture when the %s changes',
    ([, next]: readonly [string, BillingScope | undefined]) => {
      const { source, moveTo } = fakeScopeSource(PERSONAL_SCOPE)
      const onChange = vi.fn()
      const tracker = createBillingScopeTracker(source, onChange)
      const captured = tracker.capture()

      moveTo(next)

      expect(onChange).toHaveBeenCalledOnce()
      expect(captured !== undefined && tracker.isCurrent(captured)).toBe(false)
    }
  )

  it('stops watching the source once disposed', () => {
    const { source, moveTo } = fakeScopeSource(PERSONAL_SCOPE)
    const onChange = vi.fn()
    const tracker = createBillingScopeTracker(source, onChange)

    tracker.dispose()
    moveTo(undefined)

    expect(onChange).not.toHaveBeenCalled()
  })
})
