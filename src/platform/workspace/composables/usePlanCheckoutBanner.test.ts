import { effectScope } from 'vue'
import type { EffectScope } from 'vue'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const distribution = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry/reportError'))

import { usePlanCheckoutBanner } from './usePlanCheckoutBanner'

const status = {
  is_active: true,
  has_funds: true,
  max_seats: 1,
  occupied_seats: 1,
  scheduled_change: null,
  team_credit_stop: null
}

describe('usePlanCheckoutBanner', () => {
  let scope: EffectScope

  function banner() {
    const checkout = scope.run(usePlanCheckoutBanner)
    if (!checkout) throw new Error('checkout banner did not start')
    return checkout
  }

  beforeEach(() => {
    distribution.isCloud = true
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
    vi.mocked(workspaceApi.getBillingStatus).mockReset()
    vi.mocked(workspaceApi.getBillingOpStatus).mockReset()
    scope = effectScope()
  })

  afterEach(() => scope.stop())

  it('stays hidden and does not read billing when unified billing settings is off', async () => {
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = false

    const checkout = banner()
    await vi.waitFor(() => {
      expect(checkout.banner.value).toBeNull()
    })

    expect(workspaceApi.getBillingStatus).not.toHaveBeenCalled()
  })

  it('stays hidden off cloud', async () => {
    distribution.isCloud = false

    const checkout = banner()
    await Promise.resolve()

    expect(checkout.banner.value).toBeNull()
    expect(workspaceApi.getBillingStatus).not.toHaveBeenCalled()
  })

  it('does not read an operation when the subscription op id is omitted', async () => {
    vi.mocked(workspaceApi.getBillingStatus).mockResolvedValue(status)

    const checkout = banner()
    await vi.waitFor(() => {
      expect(workspaceApi.getBillingStatus).toHaveBeenCalled()
    })

    expect(workspaceApi.getBillingOpStatus).not.toHaveBeenCalled()
    expect(checkout.banner.value).toBeNull()
  })

  it('shows verify payment from the served checkout state', async () => {
    vi.mocked(workspaceApi.getBillingStatus).mockResolvedValue({
      ...status,
      latest_subscription_op_id: 'op-1'
    })
    vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
      id: 'op-1',
      started_at: '2026-10-22T00:00:00Z',
      status: 'pending',
      checkout_state: 'verify_payment',
      action_url: 'https://pay.example/verify',
      phase: 'in_progress',
      authentication_state: 'succeeded'
    })

    const checkout = banner()
    await vi.waitFor(() => {
      expect(checkout.banner.value?.kind).toBe('verifyPayment')
    })

    expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledWith('op-1')
  })

  it('stays hidden when checkout_state is omitted', async () => {
    vi.mocked(workspaceApi.getBillingStatus).mockResolvedValue({
      ...status,
      latest_subscription_op_id: 'op-1'
    })
    vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
      id: 'op-1',
      started_at: '2026-10-22T00:00:00Z',
      status: 'pending',
      phase: 'awaiting_invoice_payment',
      authentication_state: 'requires_action',
      action_url: 'https://pay.example/verify'
    })

    const checkout = banner()
    await vi.waitFor(() => {
      expect(workspaceApi.getBillingOpStatus).toHaveBeenCalled()
    })

    expect(checkout.banner.value).toBeNull()
  })

  it('loads workspace B after dropping a late answer from A', async () => {
    let resolveOperationA: (value: {
      id: string
      started_at: string
      status: 'pending'
      checkout_state: 'verify_payment'
      action_url: string
    }) => void = () => {}
    vi.mocked(workspaceApi.getBillingStatus)
      .mockResolvedValueOnce({
        ...status,
        latest_subscription_op_id: 'op-a'
      })
      .mockResolvedValueOnce({
        ...status,
        latest_subscription_op_id: 'op-b'
      })
    vi.mocked(workspaceApi.getBillingOpStatus).mockImplementation(
      async (id) => {
        if (id === 'op-a') {
          return new Promise((resolve) => {
            resolveOperationA = resolve
          })
        }
        return {
          id: 'op-b',
          started_at: '2026-10-22T00:00:00Z',
          status: 'pending',
          checkout_state: 'payment_received'
        }
      }
    )

    const checkout = banner()
    await vi.waitFor(() =>
      expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledWith('op-a')
    )

    const workspace = useTeamWorkspaceStore()
    const generation = workspace.workspaceTransitionGeneration
    workspace.resetForIdentityChange()
    expect(workspace.workspaceTransitionGeneration).toBe(generation + 1)
    await vi.waitFor(() =>
      expect(checkout.banner.value?.kind).toBe('paymentReceived')
    )

    resolveOperationA({
      id: 'op-a',
      started_at: '2026-10-22T00:00:00Z',
      status: 'pending',
      checkout_state: 'verify_payment',
      action_url: 'https://pay.example/a'
    })
    await Promise.resolve()

    expect(checkout.banner.value?.kind).toBe('paymentReceived')
  })
})
