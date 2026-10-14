import type { BillingCapabilitiesResponse } from '@comfyorg/ingest-types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

import { useBillingCapabilities } from './useBillingCapabilities'

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

const railState = vi.hoisted(() => ({
  rail: null as { readCapabilities: ReturnType<typeof vi.fn> } | null
}))
vi.mock<unknown>(
  import('@/platform/workspace/composables/useBillingReadRail'),
  () => ({ useBillingReadRail: () => railState.rail })
)

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

function heldCapabilityReads(rail: 'legacy' | 'sdk') {
  const held: Array<(response: BillingCapabilitiesResponse) => void> = []
  const nextRead = () =>
    new Promise<BillingCapabilitiesResponse>((resolve) => {
      held.push(resolve)
    })

  if (rail === 'legacy') {
    vi.mocked(workspaceApi.getBillingCapabilities).mockImplementation(nextRead)
  } else {
    railState.rail = {
      readCapabilities: vi.fn(async () => ({
        status: 'ok',
        value: await nextRead()
      }))
    }
  }

  return {
    requestCount: () => held.length,
    async answer(index: number, response: BillingCapabilitiesResponse) {
      held[index](response)
      await vi.advanceTimersByTimeAsync(0)
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
    { rail: 'legacy', switchedRole: 'member' },
    { rail: 'sdk', switchedRole: 'member' },
    { rail: 'legacy', switchedRole: 'owner' },
    { rail: 'sdk', switchedRole: 'owner' }
  ] as const)(
    'drops the owner answer that lands after another account took over ($rail rail, next account is $switchedRole)',
    async ({ rail, switchedRole }) => {
      const reads = heldCapabilityReads(rail)
      const billing = mountCapabilities()

      const initialized = billing.initialize()
      signIn(MEMBER.firebaseUid, switchedRole)
      await nextTick()
      expect(reads.requestCount()).toBe(2)

      await reads.answer(0, capabilitiesFor(OWNER.canonicalId, true))

      expect(billing.hasResolvedCapabilities.value).toBe(false)
      expect(billing.isReady.value).toBe(false)
      expect(billing.canManageMembers.value).toBe(false)
      expect(billing.canCancel.value).toBe(false)
      expect(billing.canInviteMembers.value).toBe(false)

      await reads.answer(1, capabilitiesFor(MEMBER.canonicalId, false))
      await initialized

      expect(billing.isReady.value).toBe(true)
      expect(billing.hasResolvedCapabilities.value).toBe(true)
      expect(billing.canManageMembers.value).toBe(false)
      expect(billing.canCancel.value).toBe(false)
      expect(billing.canInviteMembers.value).toBe(false)
    }
  )

  it.for(['legacy', 'sdk'] as const)(
    'clears the owner snapshot the moment another account signs in (%s rail)',
    async (rail) => {
      const reads = heldCapabilityReads(rail)
      const billing = mountCapabilities()

      const initialized = billing.initialize()
      await reads.answer(0, capabilitiesFor(OWNER.canonicalId, true))
      await initialized
      expect(billing.canManageMembers.value).toBe(true)

      signIn(MEMBER.firebaseUid, 'member')
      await nextTick()

      expect(billing.canManageMembers.value).toBe(false)
      expect(billing.canCancel.value).toBe(false)
      expect(billing.isReady.value).toBe(false)
      expect(reads.requestCount()).toBe(2)
    }
  )
})
