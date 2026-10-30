import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'
import type { WorkspaceIdentityAccess } from '@/platform/workspace/ports/workspaceIdentity'

import { useWorkspaceBillingStateStore } from './workspaceBillingStateStore'

vi.mock(import('@/platform/workspace/ports/workspaceIdentity'))

function createIdentity() {
  const identity = reactive({
    workspaces: [],
    activeWorkspace: null as WorkspaceIdentityAccess['activeWorkspace'],
    activeWorkspaceId: null as string | null,
    isInPersonalWorkspace: false,
    workspaceTransitionGeneration: 0,
    identityGeneration: 0
  })
  vi.mocked(useWorkspaceIdentity).mockReturnValue(identity)
  return identity
}

describe('workspace billing presentation', () => {
  beforeEach(() => {
    createIdentity()
  })

  it.for([
    { type: 'personal', subscription_tier: undefined, subscribed: true },
    { type: 'team', subscription_tier: undefined, subscribed: false },
    { type: 'team', subscription_tier: 'TEAM', subscribed: true }
  ] as const)(
    'preserves the listed $type/$subscription_tier summary',
    (row) => {
      const billing = useWorkspaceBillingStateStore()

      expect(billing.getSummary({ id: 'a', ...row })).toEqual({
        isSubscribed: row.subscribed,
        subscriptionTier: row.subscription_tier ?? null,
        subscriptionPlan: null
      })
    }
  )

  it('keeps status and routing scoped across switches and clears them on identity change', () => {
    const identity = createIdentity()
    const personal = {
      id: 'a',
      name: 'Personal',
      type: 'personal',
      role: 'owner',
      subscription_tier: undefined
    } as const
    const team = {
      ...personal,
      id: 'b',
      name: 'Team',
      type: 'team',
      subscription_tier: 'TEAM'
    } as const
    identity.activeWorkspace = personal
    identity.activeWorkspaceId = personal.id
    const billing = useWorkspaceBillingStateStore()
    billing.setWorkspaceBillingRail('a', 'legacy_stripe')
    billing.updateSummary('a', {
      isSubscribed: false,
      subscriptionPlan: 'monthly',
      subscriptionTier: 'STANDARD'
    })

    identity.workspaceTransitionGeneration++
    identity.activeWorkspace = team
    identity.activeWorkspaceId = team.id
    billing.setWorkspaceBillingRail('b', 'metronome')
    expect(billing.activeWorkspaceBillingRail).toBe('metronome')
    expect(billing.activeSummary).toEqual({
      isSubscribed: true,
      subscriptionTier: 'TEAM',
      subscriptionPlan: null
    })

    identity.workspaceTransitionGeneration++
    identity.activeWorkspace = personal
    identity.activeWorkspaceId = personal.id
    expect(billing.activeWorkspaceBillingRail).toBe('legacy_stripe')
    expect(billing.isWorkspaceSubscribed).toBe(false)
    expect(billing.activeSummary?.subscriptionPlan).toBe('monthly')

    identity.identityGeneration++
    expect(billing.activeWorkspaceBillingRail).toBeNull()
    expect(billing.activeSummary).toEqual({
      isSubscribed: true,
      subscriptionTier: null,
      subscriptionPlan: null
    })
  })
})
