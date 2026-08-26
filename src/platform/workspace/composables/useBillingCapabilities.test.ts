import type { BillingCapabilitiesResponse } from '@comfyorg/ingest-types'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import axios, { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

import { attachCapabilityRevisionInterceptor } from '@/platform/workspace/api/capabilityRevision'

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
      can_change_seats: true,
      can_invite_members: true,
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
    expect(billingCapabilities.canCancel.value).toBe(false)
    expect(billingCapabilities.canReactivate.value).toBe(false)
    expect(billingCapabilities.canChangeSeats.value).toBe(false)
    expect(billingCapabilities.canInviteMembers.value).toBe(false)
    expect(billingCapabilities.canDowngradeToPersonal.value).toBe(false)

    const initialization = billingCapabilities.initialize()
    expect(billingCapabilities.canTopUp.value).toBe(false)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)

    resolveRequest(capabilitiesResponse(true))
    await initialization
    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
    expect(billingCapabilities.canCancel.value).toBe(true)
    expect(billingCapabilities.canReactivate.value).toBe(true)
    expect(billingCapabilities.canChangeSeats.value).toBe(true)
    expect(billingCapabilities.canInviteMembers.value).toBe(true)
    expect(billingCapabilities.canDowngradeToPersonal.value).toBe(true)
  })

  it('applies denied server capabilities without client-side inference', async () => {
    mockGetBillingCapabilities.mockResolvedValueOnce(
      capabilitiesResponse(
        true,
        'workspace-1',
        false,
        {},
        {
          can_cancel: false,
          can_reactivate: false,
          can_change_seats: false,
          can_invite_members: false,
          can_downgrade_to_personal: false
        }
      )
    )

    await billingCapabilities.initialize()

    expect(billingCapabilities.canCancel.value).toBe(false)
    expect(billingCapabilities.canReactivate.value).toBe(false)
    expect(billingCapabilities.canChangeSeats.value).toBe(false)
    expect(billingCapabilities.canInviteMembers.value).toBe(false)
    expect(billingCapabilities.canDowngradeToPersonal.value).toBe(false)
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
    expect(billingCapabilities.canCancel.value).toBe(false)
    expect(billingCapabilities.canReactivate.value).toBe(false)
    expect(billingCapabilities.canChangeSeats.value).toBe(false)
    expect(billingCapabilities.canInviteMembers.value).toBe(false)
    expect(billingCapabilities.canDowngradeToPersonal.value).toBe(false)
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
    expect(billingCapabilities.canCancel.value).toBe(false)
    expect(billingCapabilities.canReactivate.value).toBe(false)
    expect(billingCapabilities.canChangeSeats.value).toBe(false)
    expect(billingCapabilities.canInviteMembers.value).toBe(false)
    expect(billingCapabilities.canDowngradeToPersonal.value).toBe(false)
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

  it('refetches the capability snapshot once the server snapshot expires', async () => {
    mockGetBillingCapabilities
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

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('defers the refresh until a hidden tab becomes visible again', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    mockGetBillingCapabilities
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, {
          expiresAt: expiresIn(30_000)
        })
      )
      .mockResolvedValueOnce(capabilitiesResponse(true))

    await billingCapabilities.initialize()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('reschedules for the remaining lifetime when the tab returns before expiry', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
    mockGetBillingCapabilities
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
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('retimes the refresh for the new workspace after a workspace switch', async () => {
    mockGetBillingCapabilities
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
    mockScope.workspaceId = 'workspace-2'
    await billingCapabilities.initialize()
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(65_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(3)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('stops refreshing once the shared composable scope is disposed', async () => {
    mockGetBillingCapabilities
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
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)

    scope.stop()
    await vi.advanceTimersByTimeAsync(300_000)

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('refetches when a mutation reports a different capability revision', async () => {
    mockGetBillingCapabilities
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, { revision: 4 })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, { revision: 5 })
      )

    await billingCapabilities.initialize()
    expect(billingCapabilities.canTopUp.value).toBe(false)

    await emitMutationRevision('5')

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('refetches when a failed mutation reports a different capability revision', async () => {
    mockGetBillingCapabilities
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, { revision: 4 })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, { revision: 5 })
      )

    await billingCapabilities.initialize()

    await emitMutationRevision('5', 402)

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('ignores a mutation that reports the cached capability revision', async () => {
    mockGetBillingCapabilities
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, { revision: 4 })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, { revision: 6 })
      )

    await billingCapabilities.initialize()

    await emitMutationRevision('4')
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    await emitMutationRevision('6')
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('ignores a mutation whose response omits the revision header', async () => {
    mockGetBillingCapabilities
      .mockResolvedValueOnce(
        capabilitiesResponse(false, 'workspace-1', true, { revision: 4 })
      )
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, { revision: 6 })
      )

    await billingCapabilities.initialize()

    await emitMutationRevision(undefined)
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()
    expect(billingCapabilities.canTopUp.value).toBe(false)

    await emitMutationRevision('6')
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('keeps the resolved snapshot readable while a background refresh is in flight', async () => {
    let resolveRefresh!: (value: BillingCapabilitiesResponse) => void
    mockGetBillingCapabilities
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
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
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
    mockGetBillingCapabilities
      .mockResolvedValueOnce(
        capabilitiesResponse(true, 'workspace-1', true, {
          expiresAt: expiresIn(30_000)
        })
      )
      .mockRejectedValueOnce(new Error('unavailable'))

    await billingCapabilities.initialize()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
    expect(billingCapabilities.isReady.value).toBe(true)
    expect(mockReportError).toHaveBeenCalledOnce()
  })

  it('retries on a fixed interval after a background refresh fails', async () => {
    mockGetBillingCapabilities
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
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(59_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(3)
    expect(billingCapabilities.canTopUp.value).toBe(false)
  })

  it('replaces the snapshot when a background refresh is denied', async () => {
    const { WorkspaceApiError } =
      await import('@/platform/workspace/api/workspaceApi')
    mockGetBillingCapabilities
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
    mockGetBillingCapabilities.mockResolvedValue(
      capabilitiesResponse(true, 'workspace-1', true, {
        expiresAt: expiresIn(-60_000)
      })
    )

    await billingCapabilities.initialize()
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(59_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('bounds the refresh interval when the client clock lags the server', async () => {
    mockGetBillingCapabilities.mockResolvedValue(
      capabilitiesResponse(true, 'workspace-1', true, {
        expiresAt: expiresIn(7 * 24 * 60 * 60 * 1000)
      })
    )

    await billingCapabilities.initialize()

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1_000)

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('paces the refresh on a fixed interval when the snapshot expiry is unparseable', async () => {
    mockGetBillingCapabilities.mockResolvedValue(
      capabilitiesResponse(true, 'workspace-1', true, {
        expiresAt: 'not-a-timestamp'
      })
    )

    await billingCapabilities.initialize()
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(59_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
  })

  it('refetches a read that a mutation invalidated while it was in flight', async () => {
    let resolveRefresh!: (value: BillingCapabilitiesResponse) => void
    mockGetBillingCapabilities
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
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)

    await emitMutationRevision('5')
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)

    // Serialized after the mutation stamped its header, so it carries a higher
    // revision than the mutation despite having read pre-mutation data.
    resolveRefresh(
      capabilitiesResponse(false, 'workspace-1', true, {
        revision: 7,
        expiresAt: expiresIn(3_600_000)
      })
    )
    await vi.advanceTimersByTimeAsync(0)

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(3)
    expect(billingCapabilities.canTopUp.value).toBe(true)

    await vi.advanceTimersByTimeAsync(600_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(3)
  })

  it('refetches when a mutation invalidates the initial read', async () => {
    let resolveInitial!: (value: BillingCapabilitiesResponse) => void
    mockGetBillingCapabilities
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
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    resolveInitial(
      capabilitiesResponse(false, 'workspace-1', true, { revision: 7 })
    )
    await initialization
    await vi.advanceTimersByTimeAsync(0)

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('does not refetch a read whose own response reports its revision', async () => {
    const reads = capabilityReadsThroughInterceptor()
    mockGetBillingCapabilities.mockImplementation(reads.read)

    const initialization = billingCapabilities.initialize()
    await reads.release(
      capabilitiesResponse(true, 'workspace-1', true, { revision: 4 })
    )
    await initialization

    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('refetches an interceptor-served read that a mutation invalidated in flight', async () => {
    const reads = capabilityReadsThroughInterceptor()
    mockGetBillingCapabilities.mockImplementation(reads.read)

    const initialization = billingCapabilities.initialize()
    await emitMutationRevision('5')
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    // Serialized after the mutation stamped its header, so it carries a higher
    // revision than the mutation despite having read pre-mutation data.
    await reads.release(
      capabilitiesResponse(false, 'workspace-1', true, { revision: 7 })
    )
    await initialization
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)

    await reads.release(
      capabilitiesResponse(true, 'workspace-1', true, { revision: 8 })
    )

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
  })

  it('retries an unreadable endpoint until the read succeeds', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    mockGetBillingCapabilities
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(capabilitiesResponse(true))

    await billingCapabilities.initialize()
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(false)

    await vi.advanceTimersByTimeAsync(31_000)

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
  })

  it('backs off between retries and reports the outage once', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    mockGetBillingCapabilities.mockRejectedValue(new Error('unavailable'))

    await billingCapabilities.initialize()
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(29_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(58_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(118_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(4)

    expect(mockReportError).toHaveBeenCalledOnce()
  })

  it('keeps the owner top-up fallback readable while a retry is in flight', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    let resolveRetry!: (value: BillingCapabilitiesResponse) => void
    mockGetBillingCapabilities
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockImplementationOnce(
        () =>
          new Promise<BillingCapabilitiesResponse>((resolve) => {
            resolveRetry = resolve
          })
      )

    await billingCapabilities.initialize()
    expect(billingCapabilities.canTopUp.value).toBe(true)

    await vi.advanceTimersByTimeAsync(31_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canTopUp.value).toBe(true)
    expect(billingCapabilities.isReady.value).toBe(true)

    resolveRetry(capabilitiesResponse(true))
    await vi.advanceTimersByTimeAsync(0)

    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
  })

  it('retries as soon as a hidden tab with an unreadable endpoint returns', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    mockGetBillingCapabilities
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(capabilitiesResponse(true))

    await billingCapabilities.initialize()
    await vi.advanceTimersByTimeAsync(600_000)
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect(mockGetBillingCapabilities).toHaveBeenCalledTimes(2)
    expect(billingCapabilities.canSubscribeSelfServe.value).toBe(true)
  })

  it('does not retry a denial', async () => {
    const { WorkspaceApiError } =
      await import('@/platform/workspace/api/workspaceApi')
    mockGetBillingCapabilities.mockRejectedValue(
      new WorkspaceApiError('Forbidden', 403)
    )

    await billingCapabilities.initialize()
    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(600_000)

    expect(mockGetBillingCapabilities).toHaveBeenCalledOnce()
    expect(billingCapabilities.canTopUp.value).toBe(false)
  })
})
