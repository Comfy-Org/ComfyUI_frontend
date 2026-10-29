import type { BillingCapabilitiesResponse } from '@comfyorg/ingest-types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

import type { BillingReadRail } from './useBillingReadRail'
import { useBillingCapabilities } from './useBillingCapabilities'

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

const railState = vi.hoisted((): { rail: BillingReadRail | null } => ({
  rail: null
}))
vi.mock(import('@/platform/workspace/composables/useBillingReadRail'), () => ({
  useBillingReadRail: () => railState.rail
}))

const TEAM_WORKSPACE_ID = 'workspace-team'
const OWNER = { firebaseUid: 'firebase-owner', canonicalId: 'comfy-owner' }
const MEMBER = { firebaseUid: 'firebase-member', canonicalId: 'comfy-member' }

function capabilitiesFor(
  canonicalUserId: string,
  isOwner: boolean
): BillingCapabilitiesResponse {
  return {
    resolved_for: {
      user_id: canonicalUserId,
      workspace_id: TEAM_WORKSPACE_ID
    },
    capabilities: {
      can_subscribe_self_serve: isOwner,
      can_top_up: isOwner,
      can_cancel: isOwner,
      can_reactivate: isOwner,
      can_revert_scheduled_change: isOwner,
      can_change_seats: isOwner,
      can_invite_members: isOwner,
      can_manage_members: isOwner,
      can_downgrade_to_personal: isOwner
    },
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    },
    revision: 1,
    expires_at: '2099-01-01T00:00:00Z'
  }
}

type ReadOutcome = 'outage' | 'superseded'

function notReadHere(): Promise<never> {
  return Promise.reject(new Error('not read by useBillingCapabilities'))
}

function capabilityOnlyRail(
  readCapabilities: BillingReadRail['readCapabilities']
): BillingReadRail {
  return {
    readStatus: vi.fn(notReadHere),
    readBalance: vi.fn(notReadHere),
    readPlans: vi.fn(notReadHere),
    readCapabilities: vi.fn(readCapabilities),
    readPaymentMethods: vi.fn(notReadHere),
    readEvents: vi.fn(notReadHere)
  }
}

function heldCapabilityReads(rail: 'legacy' | 'sdk') {
  const held: Array<{
    resolve: (response: BillingCapabilitiesResponse) => void
    reject: (outcome: ReadOutcome) => void
  }> = []
  const nextRead = () =>
    new Promise<BillingCapabilitiesResponse>((resolve, reject) => {
      held.push({ resolve, reject })
    })

  if (rail === 'legacy') {
    vi.mocked(workspaceApi.getBillingCapabilities).mockImplementation(() =>
      nextRead().catch(() => {
        throw new Error('capabilities outage')
      })
    )
  } else {
    railState.rail = capabilityOnlyRail(() =>
      nextRead().then(
        (value) => ({ status: 'ok', value }),
        (outcome: ReadOutcome) =>
          outcome === 'superseded'
            ? { status: 'error', code: 'SUPERSEDED' }
            : { status: 'error', code: 'REQUEST_FAILED', httpStatus: 503 }
      )
    )
  }

  async function settle() {
    await vi.advanceTimersByTimeAsync(0)
  }

  return {
    requestCount: () => held.length,
    async answer(index: number, response: BillingCapabilitiesResponse) {
      held[index].resolve(response)
      await settle()
    },
    async fail(index: number, outcome: ReadOutcome) {
      held[index].reject(outcome)
      await settle()
    }
  }
}

function signIn(firebaseUid: string, role: 'owner' | 'member') {
  Object.assign(useAuthStore(), {
    userId: firebaseUid,
    currentUser: { uid: firebaseUid }
  })
  Object.assign(useTeamWorkspaceStore(), {
    activeWorkspaceId: TEAM_WORKSPACE_ID,
    activeWorkspace: { id: TEAM_WORKSPACE_ID, role }
  })
}

describe('useBillingCapabilities across an account switch in one workspace', () => {
  let scope: EffectScope

  beforeEach(() => {
    vi.useFakeTimers()
    stubFirebaseAuthHarness()
    railState.rail = null
    signIn(OWNER.firebaseUid, 'owner')
  })

  afterEach(() => {
    scope.stop()
    railState.rail = null
  })

  function mountCapabilities() {
    scope = effectScope()
    return scope.run(() => useBillingCapabilities())!
  }

  it.for(['legacy', 'sdk'] as const)(
    'accepts the owner answer when the owner is still signed in (%s rail)',
    async (rail) => {
      const reads = heldCapabilityReads(rail)
      const billing = mountCapabilities()

      const initialized = billing.initialize()
      await reads.answer(0, capabilitiesFor(OWNER.canonicalId, true))
      await initialized

      expect(billing.isReady.value).toBe(true)
      expect(billing.canManageMembers.value).toBe(true)
      expect(billing.canCancel.value).toBe(true)
    }
  )

  it.for([
    { rail: 'legacy', switchedRole: 'member', answerOrder: [0, 1] },
    { rail: 'sdk', switchedRole: 'member', answerOrder: [0, 1] },
    { rail: 'legacy', switchedRole: 'owner', answerOrder: [0, 1] },
    { rail: 'sdk', switchedRole: 'owner', answerOrder: [0, 1] },
    { rail: 'legacy', switchedRole: 'member', answerOrder: [1, 0] },
    { rail: 'sdk', switchedRole: 'member', answerOrder: [1, 0] }
  ] as const)(
    'keeps the next account on its own answer when the owner answer lands late ($rail rail, next account is $switchedRole, answers $answerOrder)',
    async ({
      rail,
      switchedRole,
      answerOrder: [firstAnswer, secondAnswer]
    }) => {
      const reads = heldCapabilityReads(rail)
      const billing = mountCapabilities()
      const answers = [
        capabilitiesFor(OWNER.canonicalId, true),
        capabilitiesFor(MEMBER.canonicalId, false)
      ]

      const initialized = billing.initialize()
      signIn(MEMBER.firebaseUid, switchedRole)
      await nextTick()
      expect(reads.requestCount()).toBe(2)

      await reads.answer(firstAnswer, answers[firstAnswer])
      await reads.answer(secondAnswer, answers[secondAnswer])
      await initialized

      expect(billing.isReady.value).toBe(true)
      expect(billing.hasResolvedCapabilities.value).toBe(true)
      expect(billing.canManageMembers.value).toBe(false)
      expect(billing.canCancel.value).toBe(false)
      expect(billing.canInviteMembers.value).toBe(false)
    }
  )

  it.for(['legacy', 'sdk'] as const)(
    'hides the owner answer while the next account is still waiting on its own (%s rail)',
    async (rail) => {
      const reads = heldCapabilityReads(rail)
      const billing = mountCapabilities()

      void billing.initialize()
      signIn(MEMBER.firebaseUid, 'member')
      await nextTick()
      await reads.answer(0, capabilitiesFor(OWNER.canonicalId, true))

      expect(billing.hasResolvedCapabilities.value).toBe(false)
      expect(billing.isReady.value).toBe(false)
      expect(billing.canManageMembers.value).toBe(false)
      expect(billing.canCancel.value).toBe(false)
      expect(billing.canInviteMembers.value).toBe(false)

      await reads.answer(1, capabilitiesFor(MEMBER.canonicalId, false))
    }
  )

  it.for(['legacy', 'sdk'] as const)(
    'hides the owner snapshot before the switch is even observed (%s rail)',
    async (rail) => {
      const reads = heldCapabilityReads(rail)
      const billing = mountCapabilities()

      const initialized = billing.initialize()
      await reads.answer(0, capabilitiesFor(OWNER.canonicalId, true))
      await initialized
      expect(billing.canManageMembers.value).toBe(true)

      signIn(MEMBER.firebaseUid, 'member')

      expect(billing.hasResolvedCapabilities.value).toBe(false)
      expect(billing.isReady.value).toBe(false)
      expect(billing.canManageMembers.value).toBe(false)
      expect(billing.canCancel.value).toBe(false)
    }
  )

  it.for(['legacy', 'sdk'] as const)(
    'refetches for the next account once the switch is observed (%s rail)',
    async (rail) => {
      const reads = heldCapabilityReads(rail)
      const billing = mountCapabilities()

      const initialized = billing.initialize()
      await reads.answer(0, capabilitiesFor(OWNER.canonicalId, true))
      await initialized

      signIn(MEMBER.firebaseUid, 'member')
      await nextTick()
      expect(reads.requestCount()).toBe(2)
      await reads.answer(1, capabilitiesFor(MEMBER.canonicalId, false))

      expect(billing.isReady.value).toBe(true)
      expect(billing.canManageMembers.value).toBe(false)
    }
  )

  it.for([
    { rail: 'legacy', outcome: 'outage' },
    { rail: 'sdk', outcome: 'outage' },
    { rail: 'sdk', outcome: 'superseded' }
  ] as const)(
    'keeps the next account on its own answer when the owner refresh fails after the switch ($rail rail, $outcome)',
    async ({ rail, outcome }) => {
      const reads = heldCapabilityReads(rail)
      const billing = mountCapabilities()

      const initialized = billing.initialize()
      await reads.answer(0, capabilitiesFor(OWNER.canonicalId, true))
      await initialized

      void billing.refresh()
      await nextTick()
      expect(reads.requestCount()).toBe(2)

      signIn(MEMBER.firebaseUid, 'member')
      await nextTick()
      expect(reads.requestCount()).toBe(3)
      await reads.answer(2, capabilitiesFor(MEMBER.canonicalId, false))
      await reads.fail(1, outcome)

      expect(billing.isReady.value).toBe(true)
      expect(billing.hasResolvedCapabilities.value).toBe(true)
      expect(billing.canManageMembers.value).toBe(false)
      expect(billing.canCancel.value).toBe(false)
    }
  )
})
