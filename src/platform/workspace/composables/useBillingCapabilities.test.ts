import type { BillingCapabilitiesResponse } from '@comfyorg/ingest-types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

import { useBillingCapabilities } from './useBillingCapabilities'

const mockGetBillingCapabilities = vi.hoisted(() => vi.fn())
const mockIsCloud = vi.hoisted(() => ({ value: true }))
const mockScope = vi.hoisted(() => ({
  workspaceId: 'workspace-1' as string | null,
  authUid: 'firebase-user-1' as string | null
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: { getBillingCapabilities: mockGetBillingCapabilities }
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
    }
  }
}

describe('useBillingCapabilities', () => {
  let scope: EffectScope
  let billingCapabilities: ReturnType<typeof useBillingCapabilities>

  beforeEach(() => {
    mockIsCloud.value = true
    mockScope.workspaceId = 'workspace-1'
    mockScope.authUid = 'firebase-user-1'
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

    billingCapabilities.initialize()
    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)

    resolveRequest(capabilitiesResponse(true))
    await vi.waitFor(() =>
      expect(billingCapabilities.canTopUp.value).toBe(true)
    )
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
  })

  it('keeps top-up available when the endpoint is unavailable', async () => {
    mockGetBillingCapabilities.mockRejectedValueOnce(new Error('unavailable'))

    billingCapabilities.initialize()

    await vi.waitFor(() =>
      expect(billingCapabilities.canTopUp.value).toBe(true)
    )
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
  })

  it('discards a response resolved for a different workspace', async () => {
    mockGetBillingCapabilities.mockResolvedValueOnce(
      capabilitiesResponse(false, 'workspace-2')
    )

    billingCapabilities.initialize()

    await vi.waitFor(() =>
      expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()
    )
    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
  })

  it('keeps local top-up available without calling the Cloud endpoint', () => {
    mockIsCloud.value = false

    billingCapabilities.initialize()

    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)
    expect(mockGetBillingCapabilities).not.toHaveBeenCalled()
  })

  it('accepts a canonical server user ID distinct from the Firebase UID', async () => {
    mockGetBillingCapabilities.mockResolvedValueOnce(
      capabilitiesResponse(false)
    )

    billingCapabilities.initialize()

    await vi.waitFor(() =>
      expect(billingCapabilities.canTopUp.value).toBe(false)
    )
  })
})
