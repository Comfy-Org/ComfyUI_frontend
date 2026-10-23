import type { BillingCapabilitiesResponse } from '@comfyorg/ingest-types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import { webSessionUser } from '@/platform/auth/session/webSessionUser'
import { setTelemetryRegistry } from '@/platform/telemetry'
import { TelemetryRegistry } from '@/platform/telemetry/TelemetryRegistry'
import { DatadogRumTelemetryProvider } from '@/platform/telemetry/providers/cloud/DatadogRumTelemetryProvider'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

import { syncWorkspaceTelemetryContext } from './workspaceTelemetryContext'

const rum = vi.hoisted(() => ({
  addAction: vi.fn(),
  setGlobalContextProperty: vi.fn(),
  removeGlobalContextProperty: vi.fn()
}))

vi.mock<unknown>(import('@datadog/browser-rum'), () => ({ datadogRum: rum }))
vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock<unknown>(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))
vi.mock<unknown>(import('@/platform/distribution/types'), () => ({
  isCloud: true
}))
vi.mock<unknown>(
  import('@/platform/billing/composables/useBillingReadRail'),
  () => ({
    useBillingReadRail: () => null,
    provideBillingSdkStore: () => {}
  })
)

beforeEach(() => {
  stubFirebaseAuthHarness()
})

const sharedPersonalWorkspace = {
  id: 'owner-personal-team-plan',
  type: 'personal',
  role: 'member',
  subscriptionTier: 'TEAM'
} as const

const ownTeamWorkspace = {
  id: 'own-team',
  type: 'team',
  role: 'owner',
  subscriptionTier: null
} as const

function selectWorkspace(
  workspace: typeof sharedPersonalWorkspace | typeof ownTeamWorkspace | null
): void {
  Object.assign(useTeamWorkspaceStore(), {
    activeWorkspaceId: workspace?.id ?? null,
    activeWorkspace: workspace
  })
}

function rumContext(): Record<string, unknown> {
  return Object.fromEntries(
    rum.setGlobalContextProperty.mock.calls.slice(-2) as [string, unknown][]
  )
}

describe('syncWorkspaceTelemetryContext', () => {
  beforeEach(() => {
    const registry = new TelemetryRegistry()
    registry.registerProvider(new DatadogRumTelemetryProvider())
    setTelemetryRegistry(registry)
  })

  afterEach(() => {
    setTelemetryRegistry(null)
    webSessionUser.value = undefined
  })

  it('tags RUM with the selected workspace and follows every switch until disposed', async () => {
    webSessionUser.value = {
      id: 'member-user',
      email: 'member@example.com',
      emailVerified: true
    }
    selectWorkspace(sharedPersonalWorkspace)
    const scope = effectScope()
    scope.run(() => syncWorkspaceTelemetryContext())

    expect(rumContext()).toEqual({
      workspace: {
        id: 'owner-personal-team-plan',
        type: 'personal',
        role: 'member',
        tier: 'TEAM'
      },
      auth: { rail: 'web_session' }
    })

    webSessionUser.value = undefined
    selectWorkspace(ownTeamWorkspace)
    await nextTick()

    expect(rumContext()).toEqual({
      workspace: { id: 'own-team', type: 'team', role: 'owner', tier: null },
      auth: { rail: 'token' }
    })

    scope.stop()

    expect(rum.removeGlobalContextProperty).toHaveBeenCalledWith('workspace')
    expect(rum.removeGlobalContextProperty).toHaveBeenCalledWith('auth')
  })

  it('leaves RUM untagged until a workspace is selected', () => {
    selectWorkspace(null)
    const scope = effectScope()
    scope.run(() => syncWorkspaceTelemetryContext())

    expect(rum.setGlobalContextProperty).not.toHaveBeenCalled()
    scope.stop()
  })
})

describe('useBillingCapabilities workspace scope mismatch', () => {
  let scope: EffectScope

  function mount(): ReturnType<typeof useBillingCapabilities> {
    return scope.run(() => useBillingCapabilities())!
  }

  function selectWorkspace(
    selectedId: string,
    workspaces: Array<{
      id: string
      type: 'personal' | 'team'
      role: 'owner' | 'member'
      subscriptionTier: string | null
    }>
  ): void {
    Object.assign(useTeamWorkspaceStore(), {
      workspaces,
      activeWorkspaceId: selectedId,
      activeWorkspace: workspaces.find(({ id }) => id === selectedId)
    })
  }

  function capabilitiesResponse(
    resolvedWorkspaceId: string
  ): BillingCapabilitiesResponse {
    return {
      resolved_for: {
        user_id: 'canonical-user-1',
        workspace_id: resolvedWorkspaceId
      },
      capabilities: {
        can_subscribe_self_serve: false,
        can_top_up: false,
        can_cancel: false,
        can_reactivate: false,
        can_revert_scheduled_change: false,
        can_change_seats: false,
        can_invite_members: false,
        can_manage_members: false,
        can_downgrade_to_personal: false,
        can_delete_workspace: false,
        can_leave_workspace: false,
        can_manage_billing: false,
        can_manage_partner_node_access: false,
        can_view_pending_invites: false,
        can_view_team_usage: false,
        can_edit_workspace: false,
        can_manage_auto_top_up: false,
        can_manage_subscription: false,
        can_open_plans: false,
        can_run_workflows: false,
        can_upgrade: false
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

  function scopeMismatchActions(): unknown[][] {
    return rum.addAction.mock.calls.filter(
      ([name]) => name === 'workspace_scope_mismatch'
    )
  }

  beforeEach(() => {
    Object.assign(useAuthStore(), {
      userId: 'firebase-user-1',
      currentUser: { uid: 'firebase-user-1' }
    })
    const registry = new TelemetryRegistry()
    registry.registerProvider(new DatadogRumTelemetryProvider())
    setTelemetryRegistry(registry)
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
    setTelemetryRegistry(null)
    webSessionUser.value = undefined
  })

  it("reports a session-rail read for a shared personal-type workspace that resolved to the member's own Personal", async () => {
    webSessionUser.value = {
      id: 'member-user',
      email: 'member@example.com',
      emailVerified: true
    }
    selectWorkspace('owner-personal-team-plan', [
      {
        id: 'member-own-personal',
        type: 'personal',
        role: 'owner',
        subscriptionTier: 'FREE'
      },
      {
        id: 'owner-personal-team-plan',
        type: 'personal',
        role: 'member',
        subscriptionTier: 'TEAM'
      }
    ])
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      capabilitiesResponse('member-own-personal')
    )
    const billingCapabilities = mount()

    await billingCapabilities.initialize()

    expect(billingCapabilities.hasResolvedCapabilities.value).toBe(false)
    expect(scopeMismatchActions()).toEqual([
      [
        'workspace_scope_mismatch',
        {
          workspace_id: 'owner-personal-team-plan',
          workspace_type: 'personal',
          workspace_role: 'member',
          workspace_tier: 'TEAM',
          auth_rail: 'web_session',
          resolved_workspace_id: 'member-own-personal',
          resolved_workspace_type: 'personal'
        }
      ]
    ])
  })

  it('reports one stuck scope once however often it is reread', async () => {
    selectWorkspace('team-dedupe', [
      {
        id: 'team-dedupe',
        type: 'team',
        role: 'member',
        subscriptionTier: null
      }
    ])
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValue(
      capabilitiesResponse('elsewhere-dedupe')
    )
    const billingCapabilities = mount()

    await billingCapabilities.initialize()
    await billingCapabilities.refresh()
    await billingCapabilities.refresh()

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(3)
    expect(scopeMismatchActions()).toEqual([
      [
        'workspace_scope_mismatch',
        expect.objectContaining({
          workspace_id: 'team-dedupe',
          auth_rail: 'token',
          resolved_workspace_id: 'elsewhere-dedupe',
          resolved_workspace_type: 'unknown'
        })
      ]
    ])
  })

  it('does not report a read that resolved for the selected workspace', async () => {
    selectWorkspace('team-matching', [
      {
        id: 'team-matching',
        type: 'team',
        role: 'owner',
        subscriptionTier: null
      }
    ])
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      capabilitiesResponse('team-matching')
    )
    const billingCapabilities = mount()

    await billingCapabilities.initialize()

    expect(billingCapabilities.hasResolvedCapabilities.value).toBe(true)
    expect(scopeMismatchActions()).toEqual([])
  })

  it('does not report a stale read that settles after the user switched workspaces', async () => {
    const workspaces = [
      {
        id: 'team-before-switch',
        type: 'team',
        role: 'member',
        subscriptionTier: null
      },
      {
        id: 'team-after-switch',
        type: 'team',
        role: 'member',
        subscriptionTier: null
      }
    ] as const
    selectWorkspace('team-before-switch', [...workspaces])
    let settleFirstRead!: (value: BillingCapabilitiesResponse) => void
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockImplementationOnce(
        () =>
          new Promise<BillingCapabilitiesResponse>((resolve) => {
            settleFirstRead = resolve
          })
      )
      .mockResolvedValueOnce(capabilitiesResponse('team-after-switch'))
    const billingCapabilities = mount()

    const firstInitialization = billingCapabilities.initialize()
    selectWorkspace('team-after-switch', [...workspaces])
    await nextTick()
    await vi.waitFor(() =>
      expect(billingCapabilities.snapshotAuthoritative.value).toBe(true)
    )
    settleFirstRead(capabilitiesResponse('team-after-switch'))
    await firstInitialization

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.hasResolvedCapabilities.value).toBe(true)
    expect(scopeMismatchActions()).toEqual([])
  })
})
