import { setTelemetryRegistry } from '@/platform/telemetry'
import { TelemetryRegistry } from '@/platform/telemetry/TelemetryRegistry'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { BillingCapabilitiesResponse } from '@comfyorg/ingest-types'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import axios, { AxiosError, AxiosHeaders } from 'axios'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import { projectBillingCapabilities } from '@/platform/billing/sdk/billingCapabilitiesView'
import { attachCapabilityRevisionInterceptor } from '@/platform/billing/api/capabilityRevision'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'

import { useBillingCapabilities } from './useBillingCapabilities'
import { describeServerFactGate } from '@/utils/__tests__/serverFactGate'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'), { spy: true })

beforeEach(() => {
  stubFirebaseAuthHarness()
})

const mockReportError = vi.hoisted(() => vi.fn())
const mockIsCloud = vi.hoisted(() => ({ value: true }))

vi.mock(import('@/platform/workspace/api/workspaceApi'))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

/** Null is the legacy client; a rail is what the SDK store would hand back. */
const railState = vi.hoisted(() => ({
  rail: null as { readCapabilities: ReturnType<typeof vi.fn> } | null
}))
vi.mock<unknown>(
  import('@/platform/billing/composables/useBillingReadRail'),
  () => ({
    useBillingReadRail: () => railState.rail,
    provideBillingSdkStore: () => {}
  })
)

function capabilitiesResponse(
  canTopUp: boolean,
  workspaceId = 'workspace-1',
  canSubscribeSelfServe = true,
  freshness: { expiresAt?: string; revision?: number } = {},
  overrides: Partial<BillingCapabilitiesResponse['capabilities']> = {}
): BillingCapabilitiesResponse {
  return {
    resolved_for: {
      user_id: 'canonical-user-1',
      workspace_id: workspaceId
    },
    capabilities: {
      can_subscribe_self_serve: canSubscribeSelfServe,
      can_top_up: canTopUp,
      can_cancel: true,
      can_reactivate: true,
      can_revert_scheduled_change: false,
      can_change_seats: true,
      can_invite_members: true,
      can_manage_members: true,
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
      can_upgrade: false,
      can_downgrade_to_personal: true,
      ...overrides
    },
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    },
    revision: freshness.revision ?? 1,
    expires_at: freshness.expiresAt ?? '2099-01-01T00:00:00Z'
  }
}

function expiresIn(ms: number): string {
  return new Date(Date.now() + ms).toISOString()
}

/** Drives a mutation response through the shared capability-revision interceptor. */
async function emitMutationRevision(
  revision: string | undefined,
  status = 200
): Promise<void> {
  const client = axios.create()
  client.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    const response: AxiosResponse = {
      data: {},
      status,
      statusText: '',
      headers: new AxiosHeaders(
        revision === undefined ? {} : { 'X-Capability-Revision': revision }
      ),
      config
    }
    return status >= 400
      ? Promise.reject(
          new AxiosError(
            'Request failed',
            'ERR_BAD_REQUEST',
            config,
            {},
            response
          )
        )
      : Promise.resolve(response)
  }
  attachCapabilityRevisionInterceptor(client)
  await client.post('/api/billing/subscribe').catch(() => {})
  await vi.advanceTimersByTimeAsync(0)
}

/**
 * Serves capability reads through the shared revision interceptor the way the
 * real client does: the response carries the revision matching its body, and
 * axios publishes it before the awaited GET resolves. Reads settle only when
 * released, so a read that invalidates itself surfaces as one extra call
 * instead of an unbounded loop.
 */
function capabilityReadsThroughInterceptor() {
  const pending: Array<(data: BillingCapabilitiesResponse) => void> = []
  const client = axios.create()
  client.defaults.adapter = (config: InternalAxiosRequestConfig) =>
    new Promise<AxiosResponse>((resolve) => {
      pending.push((data) =>
        resolve({
          data,
          status: 200,
          statusText: '',
          headers: new AxiosHeaders({
            'X-Capability-Revision': String(data.revision)
          }),
          config
        })
      )
    })
  attachCapabilityRevisionInterceptor(client)

  return {
    read: async (): Promise<BillingCapabilitiesResponse> =>
      (
        await client.get<BillingCapabilitiesResponse>(
          '/api/billing/capabilities'
        )
      ).data,
    async release(data: BillingCapabilitiesResponse): Promise<void> {
      await vi.advanceTimersByTimeAsync(0)
      pending.shift()!(data)
      await vi.advanceTimersByTimeAsync(0)
    }
  }
}

beforeEach(() => {
  vi.mocked(workspaceApi.getBillingCapabilities).mockRejectedValue(
    new Error('Unconfigured billing capabilities request')
  )
  Object.assign(useTeamWorkspaceStore(), {
    activeWorkspaceId: 'workspace-1',
    activeWorkspace: { id: 'workspace-1', role: 'owner' }
  })
  Object.assign(useAuthStore(), {
    userId: 'firebase-user-1',
    currentUser: { uid: 'firebase-user-1' }
  })
})

describe('useBillingCapabilities', () => {
  let scope: EffectScope
  let billingCapabilities: ReturnType<typeof useBillingCapabilities>

  beforeEach(() => {
    mockIsCloud.value = true
    railState.rail = null
    scope = effectScope()
    billingCapabilities = scope.run(() => useBillingCapabilities())!
  })

  afterEach(() => scope.stop())

  it('renders plan_kind as received', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce({
      ...capabilitiesResponse(true),
      plan_kind: 'sales_managed'
    })

    await billingCapabilities.initialize()

    expect(billingCapabilities.planKind.value).toBe('sales_managed')
  })

  it('leaves plan_kind unset when the snapshot omits it', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      capabilitiesResponse(true)
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.planKind.value).toBeNull()
  })

  it.for([
    [
      'allowed',
      () => Promise.resolve(capabilitiesResponse(true)),
      'succeeded',
      'success'
    ],
    [
      'policy denied',
      () => Promise.resolve(capabilitiesResponse(false)),
      'succeeded',
      'success'
    ],
    [
      'access denied',
      () =>
        Promise.reject(
          Object.assign(new Error('signed out'), { name: 'AuthStoreError' })
        ),
      undefined,
      undefined
    ],
    [
      'unavailable',
      () => Promise.reject(new Error('network failed')),
      'failed',
      'failure'
    ]
  ] as const)(
    'records capability reads when %s',
    async ([, response, stage, outcome]) => {
      const record = vi.fn()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackBillingEvent: record })
      setTelemetryRegistry(registry)
      vi.mocked(workspaceApi.getBillingCapabilities).mockImplementationOnce(
        response
      )
      await billingCapabilities.initialize()
      if (stage === undefined) {
        expect(record).not.toHaveBeenCalled()
        return
      }
      expect(record).toHaveBeenCalledExactlyOnceWith({
        operation: 'capability_read',
        stage,
        outcome
      })
    }
  )
  afterEach(() => setTelemetryRegistry(null))

  it('denies Cloud actions while loading, then applies the server capability', async () => {
    let resolveRequest!: (value: BillingCapabilitiesResponse) => void
    vi.mocked(workspaceApi.getBillingCapabilities).mockImplementationOnce(
      () =>
        new Promise<BillingCapabilitiesResponse>((resolve) => {
          resolveRequest = resolve
        })
    )

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
    expect(billingCapabilities.canCancel.value).toBe(false)
    expect(billingCapabilities.canReactivate.value).toBe(false)
    expect(billingCapabilities.canChangeSeats.value).toBe(false)
    expect(billingCapabilities.canInviteMembers.value).toBe(false)
    expect(billingCapabilities.canManageMembers.value).toBe(false)
    expect(billingCapabilities.canDowngradeToPersonal.value).toBe(false)
    expect(billingCapabilities.snapshotAuthoritative.value).toBe(false)

    const initialization = billingCapabilities.initialize()
    expect(billingCapabilities.hasResolvedCapabilities.value).toBe(false)
    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)

    resolveRequest(capabilitiesResponse(true))
    await initialization
    expect(billingCapabilities.hasResolvedCapabilities.value).toBe(true)
    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
    expect(billingCapabilities.canCancel.value).toBe(true)
    expect(billingCapabilities.canReactivate.value).toBe(true)
    expect(billingCapabilities.canChangeSeats.value).toBe(true)
    expect(billingCapabilities.canInviteMembers.value).toBe(true)
    expect(billingCapabilities.canManageMembers.value).toBe(true)
    expect(billingCapabilities.canDowngradeToPersonal.value).toBe(true)
    expect(billingCapabilities.snapshotAuthoritative.value).toBe(true)
  })

  it('applies denied server capabilities without client-side inference', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      capabilitiesResponse(
        true,
        'workspace-1',
        false,
        {},
        {
          can_cancel: false,
          can_reactivate: false,
          can_revert_scheduled_change: false,
          can_change_seats: false,
          can_invite_members: false,
          can_manage_members: false,
          can_downgrade_to_personal: false
        }
      )
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.canCancel.value).toBe(false)
    expect(billingCapabilities.canReactivate.value).toBe(false)
    expect(billingCapabilities.canChangeSeats.value).toBe(false)
    expect(billingCapabilities.canInviteMembers.value).toBe(false)
    expect(billingCapabilities.canManageMembers.value).toBe(false)
    expect(billingCapabilities.canDowngradeToPersonal.value).toBe(false)
  })

  it.for([true, false])(
    'renders can_manage_subscription %s as served',
    async (served) => {
      expect(billingCapabilities.canManageSubscription.value).toBe(false)
      vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
        capabilitiesResponse(
          true,
          'workspace-1',
          true,
          {},
          { can_manage_subscription: served }
        )
      )

      await billingCapabilities.initialize()

      expect(billingCapabilities.canManageSubscription.value).toBe(served)
    }
  )

  it('exposes the delete capability and the reason the server named', async () => {
    const response = capabilitiesResponse(
      true,
      'workspace-1',
      true,
      {},
      { can_delete_workspace: false }
    )
    response.denied_reasons = { can_delete_workspace: 'plan_not_ended' }
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      response
    )

    expect(billingCapabilities.canDeleteWorkspace.value).toBe(false)
    expect(billingCapabilities.deleteWorkspaceDenial.value).toBeUndefined()

    await billingCapabilities.initialize()

    expect(billingCapabilities.canDeleteWorkspace.value).toBe(false)
    expect(billingCapabilities.deleteWorkspaceDenial.value).toBe(
      'plan_not_ended'
    )
  })

  it('exposes the top-up denial and billing management as the server sent them', async () => {
    const response = capabilitiesResponse(
      true,
      'workspace-1',
      true,
      {},
      {
        can_top_up: false,
        can_manage_billing: true
      }
    )
    response.denied_reasons = { can_top_up: 'payment_past_due' }
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      response
    )

    expect(billingCapabilities.topUpDenial.value).toBeUndefined()
    expect(billingCapabilities.canManageBilling.value).toBe(false)

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.topUpDenial.value).toBe('payment_past_due')
    expect(billingCapabilities.canManageBilling.value).toBe(true)
  })

  it.for([
    { served: true, expected: true },
    { served: false, expected: false },
    { served: undefined, expected: false }
  ])(
    'renders payment_recovery_available $served as $expected',
    async ({ served, expected }) => {
      const response = capabilitiesResponse(true, 'workspace-1', true)
      response.payment_recovery_available = served
      vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
        response
      )

      await billingCapabilities.initialize()

      expect(billingCapabilities.paymentRecoveryAvailable.value).toBe(expected)
    }
  )

  it('offers workspace editing only when the server does', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      capabilitiesResponse(
        true,
        'workspace-1',
        true,
        {},
        {
          can_edit_workspace: true
        }
      )
    )

    expect(billingCapabilities.canEditWorkspace.value).toBe(false)

    await billingCapabilities.initialize()

    expect(billingCapabilities.canEditWorkspace.value).toBe(true)
  })

  it('grants delete only when the server does', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      capabilitiesResponse(
        true,
        'workspace-1',
        true,
        {},
        { can_delete_workspace: true }
      )
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.canDeleteWorkspace.value).toBe(true)
    expect(billingCapabilities.deleteWorkspaceDenial.value).toBeUndefined()
  })

  it('does not infer member management from an older response', async () => {
    const response = capabilitiesResponse(true)
    Reflect.deleteProperty(response.capabilities, 'can_manage_members')
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      response
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.canInviteMembers.value).toBe(true)
    expect(billingCapabilities.canChangeSeats.value).toBe(true)
    expect(billingCapabilities.canManageMembers.value).toBe(false)
  })

  it('treats an omitted parked-payment fact as not parked', async () => {
    const response = capabilitiesResponse(true)
    Reflect.deleteProperty(response, 'has_parked_billing_operation')
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      response
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.hasParkedBillingOperation.value).toBe(false)
  })

  it('maps an explicit parked-payment fact to parked', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce({
      ...capabilitiesResponse(true),
      has_parked_billing_operation: true
    })

    await billingCapabilities.initialize()

    expect(billingCapabilities.hasParkedBillingOperation.value).toBe(true)
  })

  it('applies changed capabilities when the current scope is refreshed', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(capabilitiesResponse(false, 'workspace-1', true))
      .mockResolvedValueOnce(capabilitiesResponse(true, 'workspace-1', false))

    await billingCapabilities.initialize()
    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)

    await billingCapabilities.refresh()
    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
  })

  it('forwards the initialization signal to the capability request', async () => {
    const controller = new AbortController()
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      capabilitiesResponse(true)
    )

    await billingCapabilities.initialize(controller.signal)

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledWith(
      expect.any(AbortSignal)
    )
  })

  it('withholds top-up from owners when the endpoint is unavailable', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockRejectedValueOnce(
      new Error('unavailable')
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.hasResolvedCapabilities.value).toBe(false)
    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
    expect(billingCapabilities.canCancel.value).toBe(false)
    expect(billingCapabilities.canReactivate.value).toBe(false)
    expect(billingCapabilities.canChangeSeats.value).toBe(false)
    expect(billingCapabilities.canInviteMembers.value).toBe(false)
    expect(billingCapabilities.canManageMembers.value).toBe(false)
    expect(billingCapabilities.canDowngradeToPersonal.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(true)
    expect(billingCapabilities.snapshotAuthoritative.value).toBe(false)
    expect(mockReportError).toHaveBeenCalledOnce()
  })

  it('withholds top-up from members when the endpoint is unavailable', async () => {
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspace: { id: 'workspace-1', role: 'member' }
    })
    vi.mocked(workspaceApi.getBillingCapabilities).mockRejectedValueOnce(
      new Error('unavailable')
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(true)
    expect(billingCapabilities.snapshotAuthoritative.value).toBe(false)
  })

  it('fails closed when the endpoint denies the current actor', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockRejectedValueOnce(
      new WorkspaceApiError('Forbidden', 403)
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.hasResolvedCapabilities.value).toBe(false)
    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(true)
    expect(billingCapabilities.snapshotAuthoritative.value).toBe(true)
  })

  it('does not fail open when capability loading is aborted', async () => {
    const controller = new AbortController()
    vi.mocked(workspaceApi.getBillingCapabilities).mockImplementationOnce(
      (signal?: AbortSignal) =>
        new Promise<BillingCapabilitiesResponse>((_, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            {
              once: true
            }
          )
        })
    )

    const initialization = billingCapabilities.initialize(controller.signal)
    controller.abort()
    await initialization

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(false)
    expect(billingCapabilities.snapshotAuthoritative.value).toBe(false)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('discards a response resolved for a different workspace', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      capabilitiesResponse(false, 'workspace-2')
    )

    await billingCapabilities.initialize()

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()
    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
    expect(billingCapabilities.canCancel.value).toBe(false)
    expect(billingCapabilities.canReactivate.value).toBe(false)
    expect(billingCapabilities.canChangeSeats.value).toBe(false)
    expect(billingCapabilities.canInviteMembers.value).toBe(false)
    expect(billingCapabilities.canManageMembers.value).toBe(false)
    expect(billingCapabilities.canDowngradeToPersonal.value).toBe(false)
  })

  it('discards a stale response after the active workspace changes', async () => {
    let resolveFirstRequest!: (value: BillingCapabilitiesResponse) => void
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockImplementationOnce(
        () =>
          new Promise<BillingCapabilitiesResponse>((resolve) => {
            resolveFirstRequest = resolve
          })
      )
      .mockResolvedValueOnce(capabilitiesResponse(false, 'workspace-2', false))

    const firstInitialization = billingCapabilities.initialize()
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-2' })
    await nextTick()
    await vi.waitFor(() =>
      expect(billingCapabilities.snapshotAuthoritative.value).toBe(true)
    )

    resolveFirstRequest(capabilitiesResponse(true, 'workspace-1', true))
    await firstInitialization

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
  })

  it.for([
    { role: 'owner', served: false },
    { role: 'member', served: true }
  ] as const)(
    'applies the served top-up capability on local for a $role',
    async ({ role, served }) => {
      mockIsCloud.value = false
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: { id: 'workspace-1', role }
      })
      await nextTick()
      vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
        capabilitiesResponse(served)
      )

      await billingCapabilities.initialize()

      expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()
      expect(billingCapabilities.canTopUp.value).toBe(served)
      expect(billingCapabilities.snapshotAuthoritative.value).toBe(true)
    }
  )

  it('withholds every capability on local when the read fails', async () => {
    mockIsCloud.value = false
    vi.mocked(workspaceApi.getBillingCapabilities).mockRejectedValueOnce(
      new Error('unavailable')
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.hasResolvedCapabilities.value).toBe(false)
    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
    expect(billingCapabilities.canCancel.value).toBe(false)
    expect(billingCapabilities.canReactivate.value).toBe(false)
    expect(billingCapabilities.canChangeSeats.value).toBe(false)
    expect(billingCapabilities.canInviteMembers.value).toBe(false)
    expect(billingCapabilities.canManageMembers.value).toBe(false)
    expect(billingCapabilities.canDowngradeToPersonal.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(true)
    expect(billingCapabilities.snapshotAuthoritative.value).toBe(false)
    expect(mockReportError).toHaveBeenCalledOnce()
  })

  it('applies the served capabilities for a legacy-rail workspace on local', async () => {
    mockIsCloud.value = false
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce({
      ...capabilitiesResponse(
        true,
        'workspace-1',
        true,
        {},
        {
          can_cancel: false,
          can_reactivate: false,
          can_change_seats: false
        }
      ),
      subscription_state_authoritative: false
    })

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
    expect(billingCapabilities.canCancel.value).toBe(false)
    expect(billingCapabilities.canReactivate.value).toBe(false)
    expect(billingCapabilities.canChangeSeats.value).toBe(false)
    expect(billingCapabilities.snapshotAuthoritative.value).toBe(true)
  })

  it('does not enter pending state without an authenticated scope', async () => {
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(false)
    expect(workspaceApi.getBillingCapabilities).not.toHaveBeenCalled()
  })

  describe('for an API-key-only local session', () => {
    function signInWithApiKey(ownerId: string | null) {
      Object.assign(useApiKeyAuthStore(), {
        currentUser: ownerId === null ? null : { id: ownerId }
      })
    }

    beforeEach(async () => {
      mockIsCloud.value = false
      Object.assign(useAuthStore(), { userId: undefined, currentUser: null })
      signInWithApiKey('key-owner-1')
      await nextTick()
    })

    it.for([true, false])(
      'reaches the ready state with the served top-up capability (%s)',
      async (served) => {
        vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
          capabilitiesResponse(served, 'workspace-1', false)
        )

        await billingCapabilities.initialize()

        expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()
        expect(billingCapabilities.isReady.value).toBe(true)
        expect(billingCapabilities.snapshotAuthoritative.value).toBe(true)
        expect(billingCapabilities.canTopUp.value).toBe(served)
        expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
      }
    )

    it('reaches the ready state with every capability withheld when the server denies the key', async () => {
      vi.mocked(workspaceApi.getBillingCapabilities).mockRejectedValueOnce(
        new WorkspaceApiError('Workspace context required', 401)
      )

      await billingCapabilities.initialize()

      expect(billingCapabilities.isReady.value).toBe(true)
      expect(billingCapabilities.hasResolvedCapabilities.value).toBe(false)
      expect(billingCapabilities.canTopUp.value).toBe(false)
      expect(billingCapabilities.canManageMembers.value).toBe(false)
    })

    it.for([
      { name: 'a different owner', nextOwner: 'key-owner-2' },
      { name: 'the same owner', nextOwner: 'key-owner-1' }
    ])('rereads for a replacement key held by $name', async ({ nextOwner }) => {
      vi.mocked(workspaceApi.getBillingCapabilities)
        .mockResolvedValueOnce(capabilitiesResponse(true))
        .mockResolvedValueOnce(capabilitiesResponse(false))
      await billingCapabilities.initialize()
      expect(billingCapabilities.canTopUp.value).toBe(true)

      signInWithApiKey(null)
      await nextTick()
      expect(billingCapabilities.isReady.value).toBe(false)
      expect(billingCapabilities.canTopUp.value).toBe(false)

      signInWithApiKey(nextOwner)
      await nextTick()
      await vi.advanceTimersByTimeAsync(0)

      expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
      expect(billingCapabilities.isReady.value).toBe(true)
      expect(billingCapabilities.canTopUp.value).toBe(false)
    })

    it('hides the key owner snapshot from a Firebase user who signs in over it', async () => {
      vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
        capabilitiesResponse(true)
      )
      await billingCapabilities.initialize()
      expect(billingCapabilities.canTopUp.value).toBe(true)

      Object.assign(useAuthStore(), {
        userId: 'firebase-user-1',
        currentUser: { uid: 'firebase-user-1' }
      })

      expect(billingCapabilities.isReady.value).toBe(false)
      expect(billingCapabilities.canTopUp.value).toBe(false)
    })
  })

  it('accepts a canonical server user ID distinct from the Firebase UID', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValueOnce(
      capabilitiesResponse(false)
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(false)
  })

  it('refetches the capability snapshot once the server snapshot expires', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, {
          expiresAt: expiresIn(30_000)
        })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, {
          expiresAt: expiresIn(90_000)
        })
      )

    await billingCapabilities.initialize()
    expect(billingCapabilities.canTopUp.value).toBe(false)

    await vi.advanceTimersByTimeAsync(30_000)

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('defers the refresh until a hidden tab becomes visible again', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, {
          expiresAt: expiresIn(30_000)
        })
      )
      .mockResolvedValueOnce(capabilitiesResponse(true))

    await billingCapabilities.initialize()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('reschedules for the remaining lifetime when the tab returns before expiry', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, {
          expiresAt: expiresIn(30_000)
        })
      )
      .mockResolvedValueOnce(capabilitiesResponse(true))

    await billingCapabilities.initialize()

    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(10_000)

    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(19_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('retimes the refresh for the new workspace after a workspace switch', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, {
          expiresAt: expiresIn(30_000)
        })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-2', true, {
          expiresAt: expiresIn(120_000)
        })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-2', true, {
          expiresAt: expiresIn(600_000)
        })
      )

    await billingCapabilities.initialize()
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-2' })
    await nextTick()
    await vi.waitFor(() =>
      expect(billingCapabilities.snapshotAuthoritative.value).toBe(true)
    )
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(65_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(3)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('stops refreshing once the shared composable scope is disposed', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, {
          expiresAt: expiresIn(30_000)
        })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, {
          expiresAt: expiresIn(90_000)
        })
      )

    await billingCapabilities.initialize()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)

    scope.stop()
    await vi.advanceTimersByTimeAsync(300_000)

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('refetches when a mutation reports a different capability revision', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, { revision: 4 })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, { revision: 5 })
      )

    await billingCapabilities.initialize()
    expect(billingCapabilities.canTopUp.value).toBe(false)

    await emitMutationRevision('5')

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('refetches when a failed mutation reports a different capability revision', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, { revision: 4 })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, { revision: 5 })
      )

    await billingCapabilities.initialize()

    await emitMutationRevision('5', 402)

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('ignores a mutation that reports the cached capability revision', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, { revision: 4 })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, { revision: 6 })
      )

    await billingCapabilities.initialize()

    await emitMutationRevision('4')
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    await emitMutationRevision('6')
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('ignores a mutation whose response omits the revision header', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, { revision: 4 })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, { revision: 6 })
      )

    await billingCapabilities.initialize()

    await emitMutationRevision(undefined)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()
    expect(billingCapabilities.canTopUp.value).toBe(false)

    await emitMutationRevision('6')
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('keeps the resolved snapshot readable while a background refresh is in flight', async () => {
    let resolveRefresh!: (value: BillingCapabilitiesResponse) => void
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, {
          expiresAt: expiresIn(30_000)
        })
      )
      .mockImplementationOnce(
        () =>
          new Promise<BillingCapabilitiesResponse>((resolve) => {
            resolveRefresh = resolve
          })
      )

    await billingCapabilities.initialize()
    expect(billingCapabilities.canTopUp.value).toBe(true)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
    expect(billingCapabilities.isReady.value).toBe(true)

    resolveRefresh(
      capabilitiesResponse(false, 'workspace-1', false, {
        expiresAt: expiresIn(60_000)
      })
    )
    await vi.advanceTimersByTimeAsync(0)

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
  })

  it('keeps the last good snapshot when a background refresh fails', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, {
          expiresAt: expiresIn(30_000)
        })
      )
      .mockRejectedValueOnce(new Error('unavailable'))

    await billingCapabilities.initialize()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
    expect(billingCapabilities.isReady.value).toBe(true)
    expect(mockReportError).toHaveBeenCalledOnce()
  })

  it('retries on a fixed interval after a background refresh fails', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, {
          expiresAt: expiresIn(30_000)
        })
      )
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', false, {
          expiresAt: expiresIn(180_000)
        })
      )

    await billingCapabilities.initialize()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(59_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(3)
    expect(billingCapabilities.canTopUp.value).toBe(false)
  })

  it('replaces the snapshot when a background refresh is denied', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, {
          expiresAt: expiresIn(30_000)
        })
      )
      .mockRejectedValueOnce(new WorkspaceApiError('Forbidden', 403))

    await billingCapabilities.initialize()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(true)
  })

  it('paces the refresh on a fixed interval when the snapshot arrives expired', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValue(
      capabilitiesResponse(true, 'workspace-1', true, {
        expiresAt: expiresIn(-60_000)
      })
    )

    await billingCapabilities.initialize()
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(59_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('bounds the refresh interval when the client clock lags the server', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValue(
      capabilitiesResponse(true, 'workspace-1', true, {
        expiresAt: expiresIn(7 * 24 * 60 * 60 * 1000)
      })
    )

    await billingCapabilities.initialize()

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1_000)

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('paces the refresh on a fixed interval when the snapshot expiry is unparseable', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockResolvedValue(
      capabilitiesResponse(true, 'workspace-1', true, {
        expiresAt: 'not-a-timestamp'
      })
    )

    await billingCapabilities.initialize()
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(59_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('refetches a read that a mutation invalidated while it was in flight', async () => {
    let resolveRefresh!: (value: BillingCapabilitiesResponse) => void
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, {
          revision: 4,
          expiresAt: expiresIn(30_000)
        })
      )
      .mockImplementationOnce(
        () =>
          new Promise<BillingCapabilitiesResponse>((resolve) => {
            resolveRefresh = resolve
          })
      )
      .mockResolvedValue(
        capabilitiesResponse(true, 'workspace-1', true, {
          revision: 8,
          expiresAt: expiresIn(3_600_000)
        })
      )

    await billingCapabilities.initialize()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)

    await emitMutationRevision('5')
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)

    // Serialized after the mutation stamped its header, so it carries a higher
    // revision than the mutation despite having read pre-mutation data.
    resolveRefresh(
      capabilitiesResponse(false, 'workspace-1', true, {
        revision: 7,
        expiresAt: expiresIn(3_600_000)
      })
    )
    await vi.advanceTimersByTimeAsync(0)

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(3)
    expect(billingCapabilities.canTopUp.value).toBe(true)

    await vi.advanceTimersByTimeAsync(600_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(3)
  })

  it('refetches when a mutation invalidates the initial read', async () => {
    let resolveInitial!: (value: BillingCapabilitiesResponse) => void
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockImplementationOnce(
        () =>
          new Promise<BillingCapabilitiesResponse>((resolve) => {
            resolveInitial = resolve
          })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, { revision: 9 })
      )

    const initialization = billingCapabilities.initialize()
    await emitMutationRevision('5')
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    resolveInitial(
      capabilitiesResponse(false, 'workspace-1', true, { revision: 7 })
    )
    await initialization
    await vi.advanceTimersByTimeAsync(0)

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('does not refetch a read whose own response reports its revision', async () => {
    const reads = capabilityReadsThroughInterceptor()
    vi.mocked(workspaceApi.getBillingCapabilities).mockImplementation(
      reads.read
    )

    const initialization = billingCapabilities.initialize()
    await reads.release(
      capabilitiesResponse(true, 'workspace-1', true, { revision: 4 })
    )
    await initialization

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('refetches an interceptor-served read that a mutation invalidated in flight', async () => {
    const reads = capabilityReadsThroughInterceptor()
    vi.mocked(workspaceApi.getBillingCapabilities).mockImplementation(
      reads.read
    )

    const initialization = billingCapabilities.initialize()
    await emitMutationRevision('5')
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    // Serialized after the mutation stamped its header, so it carries a higher
    // revision than the mutation despite having read pre-mutation data.
    await reads.release(
      capabilitiesResponse(false, 'workspace-1', true, { revision: 7 })
    )
    await initialization
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)

    await reads.release(
      capabilitiesResponse(true, 'workspace-1', true, { revision: 8 })
    )

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('retries an unreadable endpoint until the read succeeds', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(capabilitiesResponse(true))

    await billingCapabilities.initialize()
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)

    await vi.advanceTimersByTimeAsync(31_000)

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
  })

  it('backs off between retries and reports the outage once', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.mocked(workspaceApi.getBillingCapabilities).mockRejectedValue(
      new Error('unavailable')
    )

    await billingCapabilities.initialize()
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(29_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(58_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(118_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(4)

    expect(mockReportError).toHaveBeenCalledOnce()
  })

  it('keeps top-up withheld from owners while a retry is in flight', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    let resolveRetry!: (value: BillingCapabilitiesResponse) => void
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockImplementationOnce(
        () =>
          new Promise<BillingCapabilitiesResponse>((resolve) => {
            resolveRetry = resolve
          })
      )

    await billingCapabilities.initialize()
    expect(billingCapabilities.canTopUp.value).toBe(false)

    await vi.advanceTimersByTimeAsync(31_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(true)

    resolveRetry(capabilitiesResponse(true))
    await vi.advanceTimersByTimeAsync(0)

    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('retries as soon as a hidden tab with an unreadable endpoint returns', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    vi.mocked(workspaceApi.getBillingCapabilities)
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(capabilitiesResponse(true))

    await billingCapabilities.initialize()
    await vi.advanceTimersByTimeAsync(600_000)
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
  })

  it('does not retry a denial', async () => {
    vi.mocked(workspaceApi.getBillingCapabilities).mockRejectedValue(
      new WorkspaceApiError('Forbidden', 403)
    )

    await billingCapabilities.initialize()
    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(600_000)

    expect(workspaceApi.getBillingCapabilities).toHaveBeenCalledOnce()
    expect(billingCapabilities.canTopUp.value).toBe(false)
  })
})

describe('useBillingCapabilities on the SDK rail', () => {
  let scope: EffectScope
  let billingCapabilities: ReturnType<typeof useBillingCapabilities>
  const readCapabilities = vi.fn()

  beforeEach(() => {
    mockIsCloud.value = true
    railState.rail = { readCapabilities }
    scope = effectScope()
    billingCapabilities = scope.run(() => useBillingCapabilities())!
  })

  afterEach(() => {
    scope.stop()
    railState.rail = null
  })

  it('applies the server capability read through the rail and leaves the legacy client alone', async () => {
    readCapabilities.mockResolvedValueOnce({
      status: 'ok',
      value: capabilitiesResponse(true)
    })

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.snapshotAuthoritative.value).toBe(true)
    expect(readCapabilities).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      forceRefresh: false
    })
    expect(workspaceApi.getBillingCapabilities).not.toHaveBeenCalled()
  })

  it('keeps the denial reasons the server sent for an owner personal workspace', async () => {
    readCapabilities.mockResolvedValueOnce({
      status: 'ok',
      value: projectBillingCapabilities({
        capabilities: {
          can_cancel: false,
          can_change_seats: false,
          can_delete_workspace: false,
          can_downgrade_to_personal: false,
          can_invite_members: false,
          can_leave_workspace: false,
          can_manage_billing: true,
          can_manage_members: true,
          can_manage_partner_node_access: false,
          can_reactivate: false,
          can_revert_scheduled_change: false,
          can_subscribe_self_serve: true,
          can_top_up: true,
          can_view_pending_invites: true,
          can_view_team_usage: false,
          can_edit_workspace: false,
          can_manage_auto_top_up: false,
          can_manage_subscription: false,
          can_open_plans: false,
          can_run_workflows: false,
          can_upgrade: false
        },
        denials: {
          can_cancel: 'no_subscription',
          can_delete_workspace: 'personal_workspace',
          can_leave_workspace: 'personal_workspace_creator',
          can_reactivate: 'no_subscription'
        },
        rolloutDefaultsApplied: {
          can_downgrade_to_personal: false,
          can_subscribe_self_serve: false,
          can_top_up: false
        },
        revision: 1,
        scope: {
          userId: 'canonical-user-1',
          workspaceId: 'workspace-1',
          role: 'owner'
        },
        freshUntil: Date.now() + 60_000
      })
    })

    await billingCapabilities.initialize()

    expect(billingCapabilities.canDeleteWorkspace.value).toBe(false)
    expect(billingCapabilities.deleteWorkspaceDenial.value).toBe(
      'personal_workspace'
    )
  })

  it('bypasses the SDK cache when a mutation reports a new revision', async () => {
    readCapabilities.mockResolvedValue({
      status: 'ok',
      value: capabilitiesResponse(true, 'workspace-1', true, { revision: 7 })
    })
    await billingCapabilities.initialize()

    await emitMutationRevision('8')

    expect(readCapabilities).toHaveBeenCalledTimes(2)
    expect(readCapabilities).toHaveBeenLastCalledWith({
      signal: expect.any(AbortSignal),
      forceRefresh: true
    })
  })

  it.for([
    {
      failure: 'ACCESS_DENIED at 403',
      result: { status: 'error', code: 'ACCESS_DENIED', httpStatus: 403 },
      canTopUp: false,
      authoritative: true,
      reads: 1
    },
    {
      failure: 'REQUEST_FAILED at 503',
      result: { status: 'error', code: 'REQUEST_FAILED', httpStatus: 503 },
      canTopUp: false,
      authoritative: false,
      reads: 2
    }
  ])(
    'treats $failure on the rail as the legacy client treats the same status',
    async ({ result, canTopUp, authoritative, reads }) => {
      readCapabilities.mockResolvedValue(result)

      await billingCapabilities.initialize()
      expect(billingCapabilities.canTopUp.value).toBe(canTopUp)
      expect(billingCapabilities.snapshotAuthoritative.value).toBe(
        authoritative
      )

      await vi.advanceTimersByTimeAsync(600_000)
      expect(readCapabilities.mock.calls.length).toBeGreaterThanOrEqual(reads)
      if (reads === 1) expect(readCapabilities).toHaveBeenCalledOnce()
    }
  )

  it('retries a read the scope moved on under without reporting it', async () => {
    readCapabilities
      .mockResolvedValueOnce({ status: 'error', code: 'SUPERSEDED' })
      .mockResolvedValueOnce({
        status: 'ok',
        value: capabilitiesResponse(true)
      })

    await billingCapabilities.initialize()
    expect(billingCapabilities.isReady.value).toBe(true)
    expect(billingCapabilities.snapshotAuthoritative.value).toBe(false)
    expect(mockReportError).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)

    expect(readCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.snapshotAuthoritative.value).toBe(true)
  })

  it.for([
    { denial: 'payment_past_due' },
    { denial: 'no_funds' },
    { denial: undefined }
  ])(
    'exposes a can_run_workflows denial of $denial as the server sent it',
    async ({ denial }) => {
      readCapabilities.mockResolvedValueOnce({
        status: 'ok',
        value: {
          ...capabilitiesResponse(true),
          denied_reasons: { can_run_workflows: denial }
        }
      })

      await billingCapabilities.initialize()

      expect(billingCapabilities.runWorkflowsDenial.value).toBe(denial)
    }
  )
})

describe('useBillingCapabilities capability gates', () => {
  type Capabilities = BillingCapabilitiesResponse['capabilities']

  let response: BillingCapabilitiesResponse
  let scope: EffectScope | null = null

  beforeEach(() => {
    mockIsCloud.value = true
    railState.rail = null
    response = capabilitiesResponse(true)
    vi.mocked(workspaceApi.getBillingCapabilities).mockImplementation(() =>
      Promise.resolve(structuredClone(response))
    )
  })

  afterEach(() => {
    scope?.stop()
    scope = null
    railState.rail = null
  })

  async function mount() {
    scope?.stop()
    scope = effectScope()
    const billingCapabilities = scope.run(() => useBillingCapabilities())!
    await billingCapabilities.initialize()
    return billingCapabilities
  }

  function otherCapabilityFlips(fact: keyof Capabilities) {
    const capabilities = capabilitiesResponse(true).capabilities
    return Object.keys(capabilities)
      .filter(
        (key): key is keyof Capabilities => key in capabilities && key !== fact
      )
      .map((key) => ({
        name: `a flipped ${key}`,
        apply: () => {
          response.capabilities[key] = !response.capabilities[key]
        }
      }))
  }

  describe.for([
    ['can_top_up', 'canTopUp'],
    ['can_subscribe_self_serve', 'canSubscribeSelfServe'],
    ['can_cancel', 'canCancel'],
    ['can_reactivate', 'canReactivate'],
    ['can_revert_scheduled_change', 'canRevertScheduledChange'],
    ['can_change_seats', 'canChangeSeats'],
    ['can_manage_members', 'canManageMembers'],
    ['can_invite_members', 'canInviteMembers'],
    ['can_downgrade_to_personal', 'canDowngradeToPersonal']
  ] as const)('%s', ([fact, gate]) => {
    describeServerFactGate({
      name: gate,
      fact: {
        set: (value) => {
          response.capabilities[fact] = value
        }
      },
      perturbations: [
        {
          name: 'the member role',
          apply: () => {
            Object.assign(useTeamWorkspaceStore(), {
              activeWorkspace: { id: 'workspace-1', role: 'member' }
            })
          }
        },
        {
          name: 'the local distribution',
          apply: () => {
            mockIsCloud.value = false
          }
        },
        ...otherCapabilityFlips(fact),
        {
          name: 'rollout defaults applied',
          apply: () => {
            response.rollout_defaults_applied = {
              can_downgrade_to_personal: true,
              can_subscribe_self_serve: true,
              can_top_up: true
            }
          }
        },
        {
          name: 'a denied reason',
          apply: () => {
            response.denied_reasons = {
              can_subscribe_self_serve: 'not_workspace_owner'
            }
          }
        },
        {
          name: 'the SDK billing rail',
          apply: () => {
            railState.rail = {
              readCapabilities: vi.fn(() =>
                Promise.resolve({
                  status: 'ok',
                  value: structuredClone(response)
                })
              )
            }
          }
        }
      ],
      mount,
      read: (billingCapabilities) => billingCapabilities[gate].value
    })
  })
})
