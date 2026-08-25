import type { BillingCapabilitiesResponse } from '@comfyorg/ingest-types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

import { useBillingCapabilities } from './useBillingCapabilities'

const mockGetBillingCapabilities = vi.hoisted(() => vi.fn())
const mockReportError = vi.hoisted(() => vi.fn())
const mockIsCloud = vi.hoisted(() => ({ value: true }))
const mockScope = vi.hoisted(() => ({
  workspaceId: 'workspace-1' as string | null,
  authUid: 'firebase-user-1' as string | null,
  role: 'owner' as 'owner' | 'member'
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  WorkspaceApiError: class WorkspaceApiError extends Error {
    constructor(
      message: string,
      public readonly status?: number
    ) {
      super(message)
      this.name = 'WorkspaceApiError'
    }
  },
  workspaceApi: { getBillingCapabilities: mockGetBillingCapabilities }
}))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mockReportError
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspaceId() {
      return mockScope.workspaceId
    },
    get activeWorkspace() {
      return mockScope.workspaceId
        ? { id: mockScope.workspaceId, role: mockScope.role }
        : null
    }
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    get currentUser() {
      return mockScope.authUid ? { uid: mockScope.authUid } : null
    }
  })
}))

function capabilitiesResponse(
  canTopUp: boolean,
  workspaceId = 'workspace-1',
  canSubscribeSelfServe = true
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
      can_change_seats: true,
      can_invite_members: true,
      can_downgrade_to_personal: false
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

describe('useBillingCapabilities', () => {
  let scope: EffectScope
  let billingCapabilities: ReturnType<typeof useBillingCapabilities>

  beforeEach(() => {
    mockIsCloud.value = true
    mockScope.workspaceId = 'workspace-1'
    mockScope.authUid = 'firebase-user-1'
    mockScope.role = 'owner'
    scope = effectScope()
    billingCapabilities = scope.run(() => useBillingCapabilities())!
  })

  afterEach(() => scope.stop())

  it('denies Cloud actions while loading, then applies the server capability', async () => {
    let resolveRequest!: (value: BillingCapabilitiesResponse) => void
    mockGetBillingCapabilities.mockImplementationOnce(
      () =>
        new Promise<BillingCapabilitiesResponse>((resolve) => {
          resolveRequest = resolve
        })
    )

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)

    const initialization = billingCapabilities.initialize()
    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)

    resolveRequest(capabilitiesResponse(true))
    await initialization
    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
  })

  it('applies changed capabilities when the current scope is refreshed', async () => {
    mockGetBillingCapabilities
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
    mockGetBillingCapabilities.mockResolvedValueOnce(capabilitiesResponse(true))

    await billingCapabilities.initialize(controller.signal)

    expect(mockGetBillingCapabilities).toHaveBeenCalledWith(
      expect.any(AbortSignal)
    )
  })

  it('keeps top-up available for owners when the endpoint is unavailable', async () => {
    mockGetBillingCapabilities.mockRejectedValueOnce(new Error('unavailable'))

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(true)
    expect(mockReportError).toHaveBeenCalledOnce()
  })

  it('withholds top-up from members when the endpoint is unavailable', async () => {
    mockScope.role = 'member'
    mockGetBillingCapabilities.mockRejectedValueOnce(new Error('unavailable'))

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(true)
  })

  it('fails closed when the endpoint denies the current actor', async () => {
    const { WorkspaceApiError } =
      await import('@/platform/workspace/api/workspaceApi')
    mockGetBillingCapabilities.mockRejectedValueOnce(
      new WorkspaceApiError('Forbidden', 403)
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(true)
  })

  it('does not fail open when capability loading is aborted', async () => {
    const controller = new AbortController()
    mockGetBillingCapabilities.mockImplementationOnce(
      (signal: AbortSignal) =>
        new Promise<BillingCapabilitiesResponse>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true
          })
        })
    )

    const initialization = billingCapabilities.initialize(controller.signal)
    controller.abort()
    await initialization

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(false)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('discards a response resolved for a different workspace', async () => {
    mockGetBillingCapabilities.mockResolvedValueOnce(
      capabilitiesResponse(false, 'workspace-2')
    )

    await billingCapabilities.initialize()

    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()
    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
  })

  it('discards a stale response after the active workspace changes', async () => {
    let resolveFirstRequest!: (value: BillingCapabilitiesResponse) => void
    mockGetBillingCapabilities
      .mockImplementationOnce(
        () =>
          new Promise<BillingCapabilitiesResponse>((resolve) => {
            resolveFirstRequest = resolve
          })
      )
      .mockResolvedValueOnce(capabilitiesResponse(false, 'workspace-2', false))

    const firstInitialization = billingCapabilities.initialize()
    mockScope.workspaceId = 'workspace-2'
    await billingCapabilities.initialize()

    resolveFirstRequest(capabilitiesResponse(true, 'workspace-1', true))
    await firstInitialization

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
  })

  it('keeps local top-up available without calling the Cloud endpoint', async () => {
    mockIsCloud.value = false

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
    expect(mockGetBillingCapabilities).not.toHaveBeenCalled()
  })

  it('preserves the local role gate for workspace members', async () => {
    mockIsCloud.value = false
    mockScope.role = 'member'

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(true)
    expect(mockGetBillingCapabilities).not.toHaveBeenCalled()
  })

  it('does not enter pending state without an authenticated scope', async () => {
    mockScope.workspaceId = null

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.isReady.value).toBe(false)
    expect(mockGetBillingCapabilities).not.toHaveBeenCalled()
  })

  it('accepts a canonical server user ID distinct from the Firebase UID', async () => {
    mockGetBillingCapabilities.mockResolvedValueOnce(
      capabilitiesResponse(false)
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(false)
  })
})
