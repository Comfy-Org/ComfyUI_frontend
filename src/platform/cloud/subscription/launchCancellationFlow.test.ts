import { useToastStore } from '@/platform/updates/common/toastStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { computed } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'

import type { BillingType, SubscriptionInfo } from '@/composables/billing/types'
import type {
  ChurnkeySession,
  ChurnkeyShowOptions
} from '@/platform/cloud/churnkey/churnkeyClient'
import type { ChurnkeySessionOutcome } from '@/platform/cloud/churnkey/types'
import type { BillingRail } from '@/platform/workspace/api/workspaceApi'

const mocks = vi.hoisted(
  (): {
    billingType: { value: BillingType }
    tier: { value: SubscriptionInfo['tier'] }
    subscription: {
      value: Pick<SubscriptionInfo, 'duration' | 'endDate'> | null
    }
    activeWorkspaceId: string | null
    billingRail: BillingRail | null
    prepare: Mock<() => Promise<ChurnkeySession | null>>
  } => ({
    billingType: { value: 'workspace' },
    tier: { value: 'PRO' },
    subscription: { value: null },
    activeWorkspaceId: 'workspace-1',
    billingRail: 'stripe',
    prepare: vi.fn()
  })
)

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/i18n'))

vi.mock(import('@/platform/cloud/churnkey/churnkeyClient'), () => ({
  prepareChurnkey: mocks.prepare
}))

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))

import { launchCancellationFlow } from './launchCancellationFlow'

function session(
  show: (options: ChurnkeyShowOptions) => Promise<ChurnkeySessionOutcome>
): ChurnkeySession {
  return { show }
}

beforeEach(() => {
  const billing = useBillingContext()
  vi.mocked(useBillingContext).mockReturnValue(billing)
  billing.type = computed(() => mocks.billingType.value)
  billing.tier = computed(() => mocks.tier.value)
  billing.subscription = computed(() =>
    mocks.subscription.value
      ? {
          isActive: true,
          tier: mocks.tier.value,
          planSlug: null,
          scheduledChange: null,
          renewalDate: null,
          isCancelled: false,
          hasFunds: true,
          agentHasFunds: true,
          ...mocks.subscription.value
        }
      : null
  )

  vi.spyOn(
    useTeamWorkspaceStore(),
    'activeWorkspaceId',
    'get'
  ).mockImplementation(() => {
    return mocks.activeWorkspaceId
  })
  vi.spyOn(
    useTeamWorkspaceStore(),
    'activeWorkspaceBillingRail',
    'get'
  ).mockImplementation(() => {
    return mocks.billingRail
  })
})

describe('launchCancellationFlow', () => {
  beforeEach(() => {
    mocks.billingType.value = 'workspace'
    mocks.subscription.value = {
      duration: 'ANNUAL',
      endDate: '2026-08-01T00:00:00Z'
    }
    mocks.activeWorkspaceId = 'workspace-1'
    mocks.billingRail = 'stripe'
  })

  it('refreshes billing after a discount without canceling or recording abandonment', async () => {
    mocks.prepare.mockResolvedValue(
      session(async () => ({ type: 'discount-applied' }))
    )
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
    expect(useBillingContext().cancelSubscription).not.toHaveBeenCalled()
    expect(showFallback).not.toHaveBeenCalled()
    expect(
      useTelemetry()?.trackSubscriptionCancellation
    ).toHaveBeenCalledExactlyOnceWith(
      'flow_opened',
      expect.objectContaining({ source: 'cancel_plan_menu' })
    )
  })

  it('tells the user without reopening cancellation when billing refresh fails after a discount', async () => {
    const error = new Error('refresh offline')
    vi.mocked(useBillingContext().fetchStatus).mockRejectedValue(error)
    mocks.prepare.mockResolvedValue(
      session(async () => ({ type: 'discount-applied' }))
    )
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(showFallback).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(error, {
      surface: 'billing',
      errorType: 'error_refreshing_billing_after_churnkey_discount'
    })
    expect(useToastStore().add).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        severity: 'warn',
        summary: 'subscription.cancelDialog.discountRefreshFailed'
      })
    )
  })

  it('does not refresh a different workspace after a discount', async () => {
    mocks.prepare.mockResolvedValue(
      session(async () => {
        mocks.activeWorkspaceId = 'workspace-2'
        return { type: 'discount-applied' }
      })
    )
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
    expect(showFallback).not.toHaveBeenCalled()
  })

  it('uses the native dialog for legacy billing', async () => {
    mocks.billingType.value = 'legacy'
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(showFallback).toHaveBeenCalledOnce()
    expect(mocks.prepare).not.toHaveBeenCalled()
  })

  it('keeps legacy cancellation available while workspace state initializes', async () => {
    mocks.billingType.value = 'legacy'
    mocks.activeWorkspaceId = null
    const openDialog = vi.fn()
    let scopeCurrent: (() => boolean) | undefined

    await launchCancellationFlow({
      showFallback: vi.fn(async ({ isScopeCurrent } = {}) => {
        scopeCurrent = isScopeCurrent
        await Promise.resolve()
        mocks.activeWorkspaceId = 'workspace-1'
        if (isScopeCurrent?.()) openDialog()
        return true
      })
    })

    expect(openDialog).toHaveBeenCalledOnce()
    expect(scopeCurrent?.()).toBe(true)
    mocks.activeWorkspaceId = 'workspace-2'
    expect(scopeCurrent?.()).toBe(true)
  })

  it('contains a failed native dialog for legacy billing', async () => {
    mocks.billingType.value = 'legacy'
    const fallbackError = new Error('dialog chunk unavailable')

    await expect(
      launchCancellationFlow({
        showFallback: vi.fn().mockRejectedValue(fallbackError)
      })
    ).resolves.toBeUndefined()

    expect(reportError).toHaveBeenCalledWith(
      fallbackError,
      expect.objectContaining({ level: 'error' })
    )
  })

  it('uses the native dialog for Metronome billing', async () => {
    mocks.billingRail = 'metronome'
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(showFallback).toHaveBeenCalledOnce()
    expect(mocks.prepare).not.toHaveBeenCalled()
  })

  it('keeps the native Metronome dialog bound to its launch workspace', async () => {
    mocks.billingRail = 'metronome'
    const openDialog = vi.fn()

    await launchCancellationFlow({
      showFallback: vi.fn(async ({ isScopeCurrent } = {}) => {
        mocks.activeWorkspaceId = 'workspace-2'
        if (isScopeCurrent?.()) openDialog()
        return true
      })
    })

    expect(openDialog).not.toHaveBeenCalled()
    expect(mocks.prepare).not.toHaveBeenCalled()
  })

  it('uses the native dialog without telemetry when no session is available', async () => {
    mocks.prepare.mockResolvedValue(null)
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(showFallback).toHaveBeenCalledOnce()
    expect(useTelemetry()?.trackSubscriptionCancellation).not.toHaveBeenCalled()
  })

  it('cancels workspace billing through the existing API callback', async () => {
    mocks.prepare.mockResolvedValue(
      session(async (options) => {
        await options.handleCancel('Too expensive')
        return { type: 'closed' }
      })
    )
    const showFallback = vi.fn()

    await launchCancellationFlow({
      cancelAt: '2026-08-02T00:00:00Z',
      showFallback
    })

    expect(useBillingContext().cancelSubscription).toHaveBeenCalledOnce()
    expect(
      useTelemetry()?.trackSubscriptionCancellation
    ).toHaveBeenNthCalledWith(1, 'flow_opened', {
      source: 'cancel_plan_menu',
      current_tier: 'pro',
      cycle: 'yearly',
      end_date: '2026-08-02T00:00:00Z'
    })
    expect(
      useTelemetry()?.trackSubscriptionCancellation
    ).toHaveBeenNthCalledWith(
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
    mocks.prepare.mockResolvedValue(
      session(async () => ({ type: 'abandoned' }))
    )

    await launchCancellationFlow({ showFallback: vi.fn() })

    expect(
      useTelemetry()?.trackSubscriptionCancellation
    ).toHaveBeenLastCalledWith(
      'abandoned',
      expect.objectContaining({
        cycle: 'yearly',
        end_date: '2026-08-01T00:00:00Z'
      })
    )
    expect(useBillingContext().cancelSubscription).not.toHaveBeenCalled()
  })

  it('falls back when preparation or the provider fails', async () => {
    const preparationError = new Error('blocked by browser')
    mocks.prepare.mockRejectedValueOnce(preparationError)
    const preparationFallback = vi.fn(() => true)

    await launchCancellationFlow({ showFallback: preparationFallback })

    expect(preparationFallback).toHaveBeenCalledWith(
      expect.objectContaining({ isScopeCurrent: expect.any(Function) })
    )
    expect(useTelemetry()?.trackSubscriptionCancellation).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(preparationError, {
      surface: 'billing',
      errorType: 'cloud_cancellation_vendor_fallback',
      tags: {
        failure_kind: 'degraded',
        feature_area: 'billing',
        operation: 'load',
        outcome: 'recovered',
        workspace_still_current: true
      },
      level: 'warning'
    })

    mocks.prepare.mockResolvedValueOnce(
      session(async () => {
        throw new Error('provider unavailable')
      })
    )
    const runtimeFallback = vi.fn()

    await launchCancellationFlow({ showFallback: runtimeFallback })

    expect(runtimeFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        flowAlreadyOpened: true,
        isScopeCurrent: expect.any(Function)
      })
    )
    expect(
      useTelemetry()?.trackSubscriptionCancellation
    ).toHaveBeenLastCalledWith(
      'failed',
      expect.objectContaining({
        cycle: 'yearly',
        end_date: '2026-08-01T00:00:00Z',
        error_message: 'provider unavailable'
      })
    )
    expect(useToastStore().add).not.toHaveBeenCalled()
  })

  it('keeps an unconfigured Churnkey environment silent', async () => {
    mocks.prepare.mockResolvedValueOnce(null)
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(showFallback).toHaveBeenCalledOnce()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports and contains a failed fallback in an unconfigured environment', async () => {
    mocks.prepare.mockResolvedValueOnce(null)
    const fallbackError = new Error('dialog chunk unavailable')

    await expect(
      launchCancellationFlow({
        showFallback: vi.fn().mockRejectedValue(fallbackError)
      })
    ).resolves.toBeUndefined()

    expect(reportError).toHaveBeenCalledWith(
      fallbackError,
      expect.objectContaining({
        tags: expect.objectContaining({
          outcome: 'failed',
          vendor_preparation_failed: false
        }),
        level: 'error'
      })
    )
  })

  it('records an abort when the workspace changes while fallback loads', async () => {
    const preparationError = new Error('blocked by browser')
    mocks.prepare.mockRejectedValueOnce(preparationError)

    await launchCancellationFlow({
      showFallback: vi.fn(async () => {
        mocks.activeWorkspaceId = 'workspace-2'
        return false
      })
    })

    expect(reportError).toHaveBeenCalledWith(
      preparationError,
      expect.objectContaining({
        tags: expect.objectContaining({
          outcome: 'aborted',
          workspace_still_current: false
        })
      })
    )
  })

  it('records an abort when a scoped fallback declines to open', async () => {
    const preparationError = new Error('blocked by browser')
    mocks.prepare.mockRejectedValueOnce(preparationError)

    await launchCancellationFlow({
      showFallback: vi.fn(async () => {
        mocks.activeWorkspaceId = 'workspace-2'
        return false
      })
    })

    expect(reportError).toHaveBeenLastCalledWith(
      preparationError,
      expect.objectContaining({
        tags: expect.objectContaining({
          outcome: 'aborted',
          workspace_still_current: false
        })
      })
    )
  })

  it('lets a lazy fallback skip opening after the workspace changes', async () => {
    mocks.prepare.mockResolvedValueOnce(null)
    const openDialog = vi.fn()

    await launchCancellationFlow({
      showFallback: vi.fn(async ({ isScopeCurrent } = {}) => {
        await Promise.resolve()
        mocks.activeWorkspaceId = 'workspace-2'
        if (isScopeCurrent?.()) openDialog()
        return false
      })
    })

    expect(openDialog).not.toHaveBeenCalled()
  })

  it('classifies a fallback failure after a workspace switch as aborted', async () => {
    mocks.prepare.mockResolvedValueOnce(null)
    const fallbackError = new Error('dialog chunk unavailable')

    await launchCancellationFlow({
      showFallback: vi.fn(async () => {
        mocks.activeWorkspaceId = 'workspace-2'
        throw fallbackError
      })
    })

    expect(reportError).toHaveBeenCalledWith(
      fallbackError,
      expect.objectContaining({
        tags: expect.objectContaining({
          failure_kind: 'degraded',
          outcome: 'aborted',
          workspace_still_current: false
        }),
        level: 'warning'
      })
    )
  })

  it('records an aborted fallback when the workspace changes during preparation', async () => {
    const preparationError = new Error('blocked by browser')
    mocks.prepare.mockImplementationOnce(async () => {
      mocks.activeWorkspaceId = 'workspace-2'
      throw preparationError
    })
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(showFallback).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(
      preparationError,
      expect.objectContaining({
        tags: expect.objectContaining({
          outcome: 'aborted',
          workspace_still_current: false
        })
      })
    )
  })

  it('reports a failed fallback instead of claiming recovery', async () => {
    mocks.prepare.mockRejectedValueOnce(new Error('blocked by browser'))
    const fallbackError = new Error('dialog chunk unavailable')

    await launchCancellationFlow({
      showFallback: vi.fn().mockRejectedValue(fallbackError)
    })

    expect(reportError).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'dialog chunk unavailable',
        stack: fallbackError.stack,
        cause: expect.objectContaining({ message: 'blocked by browser' })
      }),
      {
        surface: 'billing',
        errorType: 'cloud_cancellation_vendor_fallback',
        tags: {
          failure_kind: 'caught_unexpected',
          feature_area: 'billing',
          operation: 'load',
          outcome: 'failed',
          vendor_stage: 'preparation',
          vendor_preparation_failed: true,
          workspace_still_current: true
        },
        level: 'error'
      }
    )
  })

  it('keeps the provider failure as the cause when its fallback also fails', async () => {
    const providerError = new Error('provider unavailable')
    const fallbackError = new Error('dialog chunk unavailable')
    mocks.prepare.mockResolvedValueOnce(
      session(async () => {
        throw providerError
      })
    )

    await launchCancellationFlow({
      showFallback: vi.fn().mockRejectedValue(fallbackError)
    })

    expect(reportError).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'dialog chunk unavailable',
        stack: fallbackError.stack,
        cause: providerError
      }),
      expect.objectContaining({
        tags: expect.objectContaining({ vendor_preparation_failed: false }),
        level: 'error'
      })
    )
  })

  it('contains a frozen fallback error while preserving both failures', async () => {
    const providerError = new Error('provider unavailable')
    const fallbackCause = new Error('chunk network failure')
    const fallbackError = Object.freeze(
      new Error('dialog chunk unavailable', { cause: fallbackCause })
    )
    mocks.prepare.mockResolvedValueOnce(
      session(async () => {
        throw providerError
      })
    )

    await expect(
      launchCancellationFlow({
        showFallback: vi.fn().mockRejectedValue(fallbackError)
      })
    ).resolves.toBeUndefined()

    expect(reportError).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stack: fallbackError.stack,
        cause: providerError
      }),
      expect.anything()
    )
  })

  it('falls back and records a failed cancel callback', async () => {
    vi.mocked(useBillingContext().cancelSubscription).mockRejectedValue(
      new Error('API down')
    )
    mocks.prepare.mockResolvedValue(
      session(async (options) => {
        await options.handleCancel('Too expensive')
        return { type: 'abandoned' }
      })
    )
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(useTelemetry()?.trackSubscriptionCancellation).toHaveBeenCalledWith(
      'confirmed',
      expect.anything()
    )
    expect(useTelemetry()?.trackSubscriptionCancellation).toHaveBeenCalledWith(
      'failed',
      expect.objectContaining({ error_message: 'API down' })
    )
    expect(showFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        flowAlreadyOpened: true,
        isScopeCurrent: expect.any(Function)
      })
    )
  })

  it('stops when the active workspace changes during preparation', async () => {
    let finishPreparation: ((value: ChurnkeySession) => void) | undefined
    const show = vi.fn().mockResolvedValue({ type: 'abandoned' })
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
        return { type: 'closed' }
      })
    )
    const showFallback = vi.fn()

    await launchCancellationFlow({ showFallback })

    expect(useBillingContext().cancelSubscription).not.toHaveBeenCalled()
    expect(showFallback).not.toHaveBeenCalled()
    expect(cancellationError).toMatchObject({
      message: 'subscription.cancelDialog.workspaceChanged'
    })
  })
})
