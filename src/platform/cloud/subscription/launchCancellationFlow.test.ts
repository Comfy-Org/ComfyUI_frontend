import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ChurnkeySession,
  ChurnkeyShowOptions
} from '@/platform/cloud/churnkey/churnkeyClient'
import type { ChurnkeySessionResults } from '@/platform/cloud/churnkey/types'
import type { BillingRail } from '@/platform/workspace/api/workspaceApi'

const mocks = vi.hoisted(() => ({
  billingType: { value: 'workspace' },
  tier: { value: 'PRO' },
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
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.billingType.value = 'workspace'
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

    await launchCancellationFlow({ showFallback })

    expect(mocks.cancelSubscription).toHaveBeenCalledOnce()
    expect(mocks.trackCancellation).toHaveBeenNthCalledWith(1, 'flow_opened', {
      source: 'cancel_plan_menu',
      current_tier: 'pro'
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
    expect(mocks.trackCancellation).not.toHaveBeenCalled()

    mocks.prepare.mockResolvedValueOnce(
      session(async () => {
        throw new Error('provider unavailable')
      })
    )
    const runtimeFallback = vi.fn()

    await launchCancellationFlow({ showFallback: runtimeFallback })

    expect(runtimeFallback).toHaveBeenCalledOnce()
    expect(mocks.trackCancellation).toHaveBeenLastCalledWith(
      'failed',
      expect.objectContaining({ error_message: 'provider unavailable' })
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
    expect(showFallback).toHaveBeenCalledOnce()
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
