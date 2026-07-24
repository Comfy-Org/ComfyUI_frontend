import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ChurnkeySession,
  ChurnkeyShowOptions
} from '@/platform/cloud/churnkey/churnkeyClient'
import type { ChurnkeySessionResults } from '@/platform/cloud/churnkey/types'

const mocks = vi.hoisted(() => ({
  billingType: { value: 'workspace' },
  subscription: {
    value: {
      tier: 'PRO',
      duration: 'MONTHLY',
      planSlug: 'creator-monthly',
      endDate: '2026-08-01T00:00:00Z'
    }
  },
  tier: { value: 'PRO' },
  activeWorkspaceId: 'workspace-1' as string | null,
  billingRail: 'stripe' as 'legacy_stripe' | 'metronome' | 'stripe' | null,
  cancelSubscription: vi.fn(),
  fetchStatus: vi.fn(),
  prepare: vi.fn(),
  trackCancellation: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    type: mocks.billingType,
    subscription: mocks.subscription,
    tier: mocks.tier,
    cancelSubscription: mocks.cancelSubscription,
    fetchStatus: mocks.fetchStatus
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
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.billingType.value = 'workspace'
    mocks.activeWorkspaceId = 'workspace-1'
    mocks.billingRail = 'stripe'
    mocks.cancelSubscription.mockResolvedValue(undefined)
    mocks.fetchStatus.mockResolvedValue(undefined)
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
        return { canceled: true }
      })
    )
    const showFallback = vi.fn()

    await launchCancellationFlow({
      cancelAt: '2026-08-01T00:00:00Z',
      showFallback
    })

    expect(mocks.cancelSubscription).toHaveBeenCalledOnce()
    expect(mocks.fetchStatus).toHaveBeenCalledOnce()
    expect(mocks.trackCancellation).toHaveBeenNthCalledWith(1, 'flow_opened', {
      source: 'cancel_plan_menu',
      current_tier: 'pro',
      cycle: 'monthly',
      end_date: '2026-08-01T00:00:00Z'
    })
    expect(mocks.trackCancellation).toHaveBeenNthCalledWith(
      2,
      'confirmed',
      expect.anything()
    )
    expect(showFallback).not.toHaveBeenCalled()
  })

  it('tracks an abandoned flow when the user closes the embed', async () => {
    mocks.prepare.mockResolvedValue(session(async () => ({ aborted: true })))

    await launchCancellationFlow({ showFallback: vi.fn() })

    expect(mocks.trackCancellation).toHaveBeenLastCalledWith(
      'abandoned',
      expect.anything()
    )
    expect(mocks.cancelSubscription).not.toHaveBeenCalled()
  })

  it('falls back when preparation or the provider fails', async () => {
    mocks.prepare.mockRejectedValueOnce(new Error('blocked by browser'))
    const preparationFallback = vi.fn()

    await launchCancellationFlow({ showFallback: preparationFallback })

    expect(preparationFallback).toHaveBeenCalledOnce()
    expect(console.warn).toHaveBeenCalledWith(
      'Failed to prepare ChurnKey cancellation flow:',
      expect.any(Error)
    )
    expect(mocks.trackCancellation).not.toHaveBeenCalled()

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
      expect.objectContaining({ error_message: 'provider unavailable' })
    )
  })

  it('falls back and records a failed cancel callback', async () => {
    mocks.cancelSubscription.mockRejectedValue(new Error('API down'))
    mocks.prepare.mockResolvedValue(
      session(async (options) => {
        await options.handleCancel('Too expensive').catch(() => undefined)
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

  it('does not reopen cancellation after the API already succeeded', async () => {
    mocks.prepare.mockResolvedValue(
      session(async (options) => {
        await options.handleCancel('Too expensive')
        throw new Error('late provider error')
      })
    )
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(mocks.cancelSubscription).toHaveBeenCalledOnce()
    expect(showFallback).not.toHaveBeenCalled()
    expect(mocks.trackCancellation).not.toHaveBeenCalledWith(
      'failed',
      expect.anything()
    )
  })

  it('ignores a second launch while the first flow is open', async () => {
    let closeFlow: ((result: ChurnkeySessionResults) => void) | undefined
    mocks.prepare.mockResolvedValue(
      session(
        () =>
          new Promise((resolve) => {
            closeFlow = resolve
          })
      )
    )

    const first = launchCancellationFlow({ showFallback: vi.fn() })
    await vi.waitFor(() => expect(closeFlow).toBeTypeOf('function'))
    await launchCancellationFlow({ showFallback: vi.fn() })

    expect(mocks.prepare).toHaveBeenCalledOnce()
    const resolveFlow = closeFlow
    if (!resolveFlow) throw new Error('Expected the flow to be open')
    resolveFlow({ aborted: true })
    await first
  })

  it('does not show or cancel for a workspace selected during preparation', async () => {
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
    const resolvePreparation = finishPreparation
    if (!resolvePreparation) throw new Error('Expected preparation to be open')
    resolvePreparation(session(show))
    await flow

    expect(show).not.toHaveBeenCalled()
    expect(mocks.cancelSubscription).not.toHaveBeenCalled()
    expect(showFallback).not.toHaveBeenCalled()
  })

  it('does not fall back for a workspace selected during failed preparation', async () => {
    let failPreparation: ((reason: Error) => void) | undefined
    mocks.prepare.mockReturnValue(
      new Promise((_resolve, reject) => {
        failPreparation = reject
      })
    )
    const showFallback = vi.fn()

    const flow = launchCancellationFlow({ showFallback })
    await vi.waitFor(() => expect(failPreparation).toBeTypeOf('function'))
    mocks.activeWorkspaceId = 'workspace-2'
    const rejectPreparation = failPreparation
    if (!rejectPreparation) throw new Error('Expected preparation to be open')
    rejectPreparation(new Error('provider unavailable'))
    await flow

    expect(showFallback).not.toHaveBeenCalled()
    expect(mocks.cancelSubscription).not.toHaveBeenCalled()
  })

  it('rejects cancellation after the active workspace changes', async () => {
    mocks.prepare.mockResolvedValue(
      session(async (options) => {
        mocks.activeWorkspaceId = 'workspace-2'
        await options.handleCancel('Too expensive')
        return { canceled: true }
      })
    )
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(mocks.cancelSubscription).not.toHaveBeenCalled()
    expect(showFallback).not.toHaveBeenCalled()
  })
})
