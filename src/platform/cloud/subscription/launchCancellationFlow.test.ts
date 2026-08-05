import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SubscriptionInfo } from '@/composables/billing/types'
import type {
  ChurnkeySession,
  ChurnkeyShowOptions
} from '@/platform/cloud/churnkey/churnkeyClient'
import type { ChurnkeySessionResults } from '@/platform/cloud/churnkey/types'
import type { BillingRail } from '@/platform/workspace/api/workspaceApi'

const mocks = vi.hoisted(() => ({
  billingType: { value: 'workspace' },
  tier: { value: 'PRO' },
  subscription: {
    value: null as Pick<SubscriptionInfo, 'duration' | 'endDate'> | null
  },
  activeWorkspaceId: 'workspace-1' as string | null,
  billingRail: 'stripe' as BillingRail | null,
  cancelSubscription: vi.fn(),
  prepare: vi.fn(),
  trackCancellation: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    type: mocks.billingType,
    tier: mocks.tier,
    subscription: mocks.subscription,
    cancelSubscription: mocks.cancelSubscription
  })
}))

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

vi.mock('@/platform/cloud/churnkey/churnkeyClient', () => ({
  prepareChurnkey: mocks.prepare
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackSubscriptionCancellation: mocks.trackCancellation
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspaceId() {
      return mocks.activeWorkspaceId
    },
    get activeWorkspaceBillingRail() {
      return mocks.billingRail
    }
  })
}))

import { launchCancellationFlow } from './launchCancellationFlow'

function session(
  show: (options: ChurnkeyShowOptions) => Promise<ChurnkeySessionResults>
): ChurnkeySession {
  return { show }
}

describe('launchCancellationFlow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.resetAllMocks()
    mocks.billingType.value = 'workspace'
    mocks.subscription.value = {
      duration: 'ANNUAL',
      endDate: '2026-08-01T00:00:00Z'
    }
    mocks.activeWorkspaceId = 'workspace-1'
    mocks.billingRail = 'stripe'
    mocks.cancelSubscription.mockResolvedValue(undefined)
  })

  it('uses the native dialog for legacy billing', async () => {
    mocks.billingType.value = 'legacy'
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(showFallback).toHaveBeenCalledOnce()
    expect(mocks.prepare).not.toHaveBeenCalled()
  })

  it('uses the native dialog for Metronome billing', async () => {
    mocks.billingRail = 'metronome'
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(showFallback).toHaveBeenCalledOnce()
    expect(mocks.prepare).not.toHaveBeenCalled()
  })

  it('uses the native dialog without telemetry when no session is available', async () => {
    mocks.prepare.mockResolvedValue(null)
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(showFallback).toHaveBeenCalledOnce()
    expect(mocks.trackCancellation).not.toHaveBeenCalled()
  })

  it('cancels workspace billing through the existing API callback', async () => {
    mocks.prepare.mockResolvedValue(
      session(async (options) => {
        await options.handleCancel('Too expensive')
        return { aborted: false }
      })
    )
    const showFallback = vi.fn()

    await launchCancellationFlow({
      cancelAt: '2026-08-02T00:00:00Z',
      showFallback
    })

    expect(mocks.cancelSubscription).toHaveBeenCalledOnce()
    expect(mocks.trackCancellation).toHaveBeenNthCalledWith(1, 'flow_opened', {
      source: 'cancel_plan_menu',
      current_tier: 'pro',
      cycle: 'yearly',
      end_date: '2026-08-02T00:00:00Z'
    })
    expect(mocks.trackCancellation).toHaveBeenNthCalledWith(
      2,
      'confirmed',
      expect.objectContaining({
        cycle: 'yearly',
        end_date: '2026-08-02T00:00:00Z'
      })
    )
    expect(showFallback).not.toHaveBeenCalled()
  })

  it('tracks an abandoned flow when the user closes the embed', async () => {
    mocks.prepare.mockResolvedValue(session(async () => ({ aborted: true })))

    await launchCancellationFlow({ showFallback: vi.fn() })

    expect(mocks.trackCancellation).toHaveBeenLastCalledWith(
      'abandoned',
      expect.objectContaining({
        cycle: 'yearly',
        end_date: '2026-08-01T00:00:00Z'
      })
    )
    expect(mocks.cancelSubscription).not.toHaveBeenCalled()
  })

  it('falls back when preparation or the provider fails', async () => {
    const preparationError = new Error('blocked by browser')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.prepare.mockRejectedValueOnce(preparationError)
    const preparationFallback = vi.fn()

    await launchCancellationFlow({ showFallback: preparationFallback })

    expect(preparationFallback).toHaveBeenCalledWith()
    expect(mocks.trackCancellation).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      'Failed to prepare Churnkey cancellation flow:',
      preparationError
    )

    mocks.prepare.mockResolvedValueOnce(
      session(async () => {
        throw new Error('provider unavailable')
      })
    )
    const runtimeFallback = vi.fn()

    await launchCancellationFlow({ showFallback: runtimeFallback })

    expect(runtimeFallback).toHaveBeenCalledWith({ flowAlreadyOpened: true })
    expect(mocks.trackCancellation).toHaveBeenLastCalledWith(
      'failed',
      expect.objectContaining({
        cycle: 'yearly',
        end_date: '2026-08-01T00:00:00Z',
        error_message: 'provider unavailable'
      })
    )
  })

  it('falls back and records a failed cancel callback', async () => {
    mocks.cancelSubscription.mockRejectedValue(new Error('API down'))
    mocks.prepare.mockResolvedValue(
      session(async (options) => {
        await options.handleCancel('Too expensive')
        return { aborted: true }
      })
    )
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(mocks.trackCancellation).toHaveBeenCalledWith(
      'confirmed',
      expect.anything()
    )
    expect(mocks.trackCancellation).toHaveBeenCalledWith(
      'failed',
      expect.objectContaining({ error_message: 'API down' })
    )
    expect(showFallback).toHaveBeenCalledWith({ flowAlreadyOpened: true })
  })

  it('stops when the active workspace changes during preparation', async () => {
    let finishPreparation: ((value: ChurnkeySession) => void) | undefined
    const show = vi.fn().mockResolvedValue({ aborted: true })
    mocks.prepare.mockReturnValue(
      new Promise((resolve) => {
        finishPreparation = resolve
      })
    )
    const showFallback = vi.fn()

    const flow = launchCancellationFlow({ showFallback })
    await vi.waitFor(() => expect(finishPreparation).toBeTypeOf('function'))
    mocks.activeWorkspaceId = 'workspace-2'
    finishPreparation?.(session(show))
    await flow

    expect(show).not.toHaveBeenCalled()
    expect(showFallback).not.toHaveBeenCalled()
  })

  it('does not cancel after the active workspace changes', async () => {
    let cancellationError: unknown
    mocks.prepare.mockResolvedValue(
      session(async (options) => {
        mocks.activeWorkspaceId = 'workspace-2'
        try {
          await options.handleCancel()
        } catch (error) {
          cancellationError = error
          throw error
        }
        return { aborted: false }
      })
    )
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(mocks.cancelSubscription).not.toHaveBeenCalled()
    expect(showFallback).not.toHaveBeenCalled()
    expect(cancellationError).toMatchObject({
      message: 'subscription.cancelDialog.workspaceChanged'
    })
  })
})
