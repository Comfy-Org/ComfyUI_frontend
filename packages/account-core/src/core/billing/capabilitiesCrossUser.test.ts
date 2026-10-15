import { assert, describe, expect, it } from 'vitest'

import type { SessionSnapshot } from '../session.js'
import type { AccountCredential } from '../sessionContracts.js'
import type {
  BillingHttpResponse,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import { sessionBillingScopeSource } from './billingScope.js'
import { createCapabilitiesReader } from './capabilities.js'
import {
  authenticated,
  credential,
  httpOk
} from './__fixtures__/billingTestFixtures.js'
import type { SessionFake } from './__fixtures__/billingTestFixtures.js'

const TEAM_WORKSPACE: AccountCredential['workspace'] = {
  id: 'ws-team',
  name: 'Team',
  type: 'team'
}

const OWNER_SESSION = authenticated(
  credential({
    uid: 'firebase-owner',
    workspace: TEAM_WORKSPACE,
    role: 'owner'
  })
)
const MEMBER_SESSION = authenticated(
  credential({
    uid: 'firebase-member',
    workspace: TEAM_WORKSPACE,
    role: 'member'
  })
)
const SECOND_OWNER_SESSION = authenticated(
  credential({
    uid: 'firebase-second-owner',
    workspace: TEAM_WORKSPACE,
    role: 'owner'
  })
)

const TAKEOVERS = [
  { takeover: 'a member', next: MEMBER_SESSION },
  { takeover: 'another owner with the same role', next: SECOND_OWNER_SESSION }
]

const NO_RIGHTS = {
  can_cancel: false,
  can_change_seats: false,
  can_downgrade_to_personal: false,
  can_invite_members: false,
  can_manage_members: false,
  can_reactivate: false,
  can_revert_scheduled_change: false,
  can_subscribe_self_serve: false,
  can_top_up: false
}

function capabilitiesBody(
  canonicalUserId: string,
  rights: Partial<typeof NO_RIGHTS>
) {
  return {
    capabilities: { ...NO_RIGHTS, ...rights },
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    resolved_for: { user_id: canonicalUserId, workspace_id: TEAM_WORKSPACE.id },
    revision: 7,
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    }
  }
}

const OWNER_ANSWER = httpOk(
  capabilitiesBody('comfy-owner', {
    can_manage_members: true,
    can_cancel: true
  })
)
const MEMBER_ANSWER = httpOk(capabilitiesBody('comfy-member', {}))

function switchableSession(initial: SessionSnapshot) {
  let snapshot = initial
  const listeners = new Set<(next: SessionSnapshot) => void>()
  const fake: SessionFake = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
  return {
    scopeSource: sessionBillingScopeSource(fake),
    switchTo(next: SessionSnapshot) {
      snapshot = next
      for (const listener of Array.from(listeners)) listener(snapshot)
    }
  }
}

function heldTransport() {
  const held: Array<(answer: BillingResult<BillingHttpResponse>) => void> = []
  const transport: BillingTransport = () =>
    new Promise((resolve) => {
      held.push(resolve)
    })
  return {
    transport,
    answer(index: number, response: BillingResult<BillingHttpResponse>) {
      held[index](response)
    },
    requestCount: () => held.length
  }
}

describe('capabilities read across an account switch in one workspace', () => {
  it('publishes the owner answer when the owner is still signed in', async () => {
    const session = switchableSession(OWNER_SESSION)
    const network = heldTransport()
    const reader = createCapabilitiesReader({
      transport: network.transport,
      scopeSource: session.scopeSource
    })

    const ownerRead = reader.read()
    network.answer(0, OWNER_ANSWER)
    const result = await ownerRead

    expect(result.status).toBe('ok')
    expect(reader.getSnapshot()?.capabilities.can_manage_members).toBe(true)
    expect(reader.getSnapshot()?.capabilities.can_cancel).toBe(true)
    expect(reader.getSnapshot()?.scope.userId).toBe('firebase-owner')
  })

  it.for(TAKEOVERS)(
    'refuses the owner answer that lands after $takeover took over',
    async ({ next }) => {
      const session = switchableSession(OWNER_SESSION)
      const network = heldTransport()
      const reader = createCapabilitiesReader({
        transport: network.transport,
        scopeSource: session.scopeSource
      })

      const ownerRead = reader.read()
      session.switchTo(next)
      network.answer(0, OWNER_ANSWER)

      expect(await ownerRead).toEqual({ status: 'error', code: 'SUPERSEDED' })
      expect(reader.getSnapshot()).toBeUndefined()
    }
  )

  it('refuses the owner answer when the owner signs back in before it lands', async () => {
    const session = switchableSession(OWNER_SESSION)
    const network = heldTransport()
    const reader = createCapabilitiesReader({
      transport: network.transport,
      scopeSource: session.scopeSource
    })

    const firstOwnerRead = reader.read()
    session.switchTo(MEMBER_SESSION)
    session.switchTo(OWNER_SESSION)
    network.answer(0, OWNER_ANSWER)

    expect(await firstOwnerRead).toEqual({
      status: 'error',
      code: 'SUPERSEDED'
    })
    expect(reader.getSnapshot()).toBeUndefined()
  })

  it.for([
    { order: 'member answer first', answerOrder: [1, 0] },
    { order: 'owner answer first', answerOrder: [0, 1] }
  ])(
    'serves the member only their own rights ($order)',
    async ({ answerOrder: [firstAnswer, secondAnswer] }) => {
      const session = switchableSession(OWNER_SESSION)
      const network = heldTransport()
      const reader = createCapabilitiesReader({
        transport: network.transport,
        scopeSource: session.scopeSource
      })
      const answers = [OWNER_ANSWER, MEMBER_ANSWER]

      const ownerRead = reader.read()
      session.switchTo(MEMBER_SESSION)
      const memberRead = reader.read()
      expect(network.requestCount()).toBe(2)

      network.answer(firstAnswer, answers[firstAnswer])
      network.answer(secondAnswer, answers[secondAnswer])

      const memberResult = await memberRead
      expect(await ownerRead).toEqual({ status: 'error', code: 'SUPERSEDED' })
      assert(memberResult.status === 'ok', 'member read resolves')
      expect(memberResult.value.capabilities.can_manage_members).toBe(false)
      expect(memberResult.value.capabilities.can_cancel).toBe(false)
      expect(reader.getSnapshot()?.scope).toEqual({
        userId: 'firebase-member',
        workspaceId: TEAM_WORKSPACE.id,
        role: 'member'
      })
      expect(reader.getSnapshot()?.capabilities.can_manage_members).toBe(false)
      expect(reader.getSnapshot()?.capabilities.can_cancel).toBe(false)
    }
  )

  it.for(TAKEOVERS)(
    'never serves the owner cached snapshot to $takeover',
    async ({ next }) => {
      const session = switchableSession(OWNER_SESSION)
      const network = heldTransport()
      const reader = createCapabilitiesReader({
        transport: network.transport,
        scopeSource: session.scopeSource
      })

      const ownerRead = reader.read()
      network.answer(0, OWNER_ANSWER)
      await ownerRead
      session.switchTo(next)

      expect(reader.getSnapshot()).toBeUndefined()
      const nextRead = reader.read()
      expect(network.requestCount()).toBe(2)
      network.answer(1, MEMBER_ANSWER)
      const nextResult = await nextRead

      assert(nextResult.status === 'ok', 'next account read resolves')
      expect(nextResult.value.capabilities.can_manage_members).toBe(false)
    }
  )
})
