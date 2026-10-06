import type { RetentionFlowResponse } from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import type { BillingType, SubscriptionInfo } from '@/composables/billing/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { RetentionOfferOutcome } from '@/platform/cloud/subscription/utils/retentionOffer'
import { useTelemetry } from '@/platform/telemetry'
import { TelemetryRegistry } from '@/platform/telemetry/TelemetryRegistry'
import { DatadogRumTelemetryProvider } from '@/platform/telemetry/providers/cloud/DatadogRumTelemetryProvider'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { BillingRail } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import type { RetentionOfferDialogOptions } from './launchCancellationFlow'
import { launchCancellationFlow } from './launchCancellationFlow'

const mocks = vi.hoisted(
  (): {
    billingType: { value: BillingType }
    tier: { value: SubscriptionInfo['tier'] }
    subscription: {
      value: Pick<SubscriptionInfo, 'duration' | 'endDate'> | null
    }
    activeWorkspaceId: string | null
    billingRail: BillingRail | null
  } => ({
    billingType: { value: 'workspace' },
    tier: { value: 'PRO' },
    subscription: { value: null },
    activeWorkspaceId: 'workspace-1',
    billingRail: 'stripe'
  })
)

const mockRumAddAction = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@datadog/browser-rum'), () => ({
  datadogRum: { addAction: mockRumAddAction }
}))

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/i18n'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))

const offer = {
  id: 'save_30_next_3_v1',
  percent_off: 30,
  duration_in_months: 3
}

function retentionFlow(
  overrides: Partial<RetentionFlowResponse> = {}
): RetentionFlowResponse {
  return {
    session_id: '00000000-0000-4000-8000-000000000001',
    expires_at: 2_000_000_000,
    subscription: {
      currency: 'usd',
      unit_amount: 2000,
      quantity: 1,
      period_end: 2_000_000_000
    },
    ...overrides
  }
}

function offersRetention() {
  vi.mocked(workspaceApi.prepareRetentionFlow).mockResolvedValue(
    retentionFlow({ experiment_variant: offer.id, offer })
  )
}

function decides(outcome: RetentionOfferOutcome) {
  return vi.fn(async (_options: RetentionOfferDialogOptions) => outcome)
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
  ).mockImplementation(() => mocks.activeWorkspaceId)
  vi.spyOn(
    useTeamWorkspaceStore(),
    'activeWorkspaceBillingRail',
    'get'
  ).mockImplementation(() => mocks.billingRail)
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

  it.for([
    { name: 'legacy billing', billingType: 'legacy', billingRail: 'stripe' },
    {
      name: 'Metronome billing',
      billingType: 'workspace',
      billingRail: 'metronome'
    }
  ] as const)(
    'uses the standard dialog for $name',
    async ({ billingType, billingRail }) => {
      mocks.billingType.value = billingType
      mocks.billingRail = billingRail
      const showFallback = vi.fn()
      const showRetentionOffer = decides('dismissed')

      await launchCancellationFlow({ showFallback, showRetentionOffer })

      expect(showFallback).toHaveBeenCalledOnce()
      expect(workspaceApi.prepareRetentionFlow).not.toHaveBeenCalled()
      expect(showRetentionOffer).not.toHaveBeenCalled()
    }
  )

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
      }),
      showRetentionOffer: decides('dismissed')
    })

    expect(openDialog).toHaveBeenCalledOnce()
    expect(scopeCurrent?.()).toBe(true)
    mocks.activeWorkspaceId = 'workspace-2'
    expect(scopeCurrent?.()).toBe(true)
  })

  it('keeps the standard Metronome dialog bound to its launch workspace', async () => {
    mocks.billingRail = 'metronome'
    const openDialog = vi.fn()

    await launchCancellationFlow({
      showFallback: vi.fn(async ({ isScopeCurrent } = {}) => {
        mocks.activeWorkspaceId = 'workspace-2'
        if (isScopeCurrent?.()) openDialog()
        return true
      }),
      showRetentionOffer: decides('dismissed')
    })

    expect(openDialog).not.toHaveBeenCalled()
  })

  it.for([
    { workspaceStillCurrent: true, level: 'error', toast: true },
    { workspaceStillCurrent: false, level: 'warning', toast: false }
  ])(
    'contains a standard dialog that fails to open (workspace current: $workspaceStillCurrent)',
    async ({ workspaceStillCurrent, level, toast }) => {
      mocks.billingType.value = 'legacy'
      const fallbackError = new Error('dialog chunk unavailable')

      await expect(
        launchCancellationFlow({
          showFallback: vi.fn(async () => {
            if (!workspaceStillCurrent) mocks.activeWorkspaceId = 'workspace-2'
            throw fallbackError
          }),
          showRetentionOffer: decides('dismissed')
        })
      ).resolves.toBeUndefined()

      expect(reportError).toHaveBeenCalledWith(
        fallbackError,
        expect.objectContaining({ level })
      )
      expect(vi.mocked(useToastStore().add).mock.calls.length > 0).toBe(toast)
    }
  )

  it.for([
    {
      name: 'offers are switched off',
      error: new WorkspaceApiError('off', 503),
      reported: false
    },
    {
      name: 'the plan is ineligible',
      error: new WorkspaceApiError('no', 422),
      reported: false
    },
    {
      name: 'billing-api fails',
      error: new WorkspaceApiError('boom', 500),
      reported: true
    },
    {
      name: 'the request is lost',
      error: new Error('Network Error'),
      reported: true
    }
  ])('opens the standard dialog when $name', async ({ error, reported }) => {
    vi.mocked(workspaceApi.prepareRetentionFlow).mockRejectedValue(error)
    const showFallback = vi.fn()
    const showRetentionOffer = decides('dismissed')

    await launchCancellationFlow({ showFallback, showRetentionOffer })

    expect(showFallback).toHaveBeenCalledOnce()
    expect(showRetentionOffer).not.toHaveBeenCalled()
    expect(workspaceApi.recordRetentionFlowEvent).not.toHaveBeenCalled()
    expect(vi.mocked(reportError).mock.calls.length > 0).toBe(reported)
  })

  it.for([
    {
      name: 'the control arm',
      flow: retentionFlow({ experiment_variant: 'control' })
    },
    { name: 'a session outside the experiment', flow: retentionFlow() }
  ])(
    'records participation and opens the standard dialog for $name',
    async ({ flow }) => {
      vi.mocked(workspaceApi.prepareRetentionFlow).mockResolvedValue(flow)
      const showFallback = vi.fn()
      const showRetentionOffer = decides('dismissed')

      await launchCancellationFlow({ showFallback, showRetentionOffer })

      expect(
        workspaceApi.recordRetentionFlowEvent
      ).toHaveBeenCalledExactlyOnceWith({
        session_id: flow.session_id,
        event: 'flow_opened'
      })
      expect(showFallback).toHaveBeenCalledExactlyOnceWith(
        expect.not.objectContaining({ flowAlreadyOpened: true })
      )
      expect(showRetentionOffer).not.toHaveBeenCalled()
    }
  )

  it('shows the offer bound to its session and launch workspace', async () => {
    offersRetention()
    const showRetentionOffer = decides('retained')

    await launchCancellationFlow({ showFallback: vi.fn(), showRetentionOffer })

    expect(showRetentionOffer).toHaveBeenCalledExactlyOnceWith({
      offer,
      subscription: retentionFlow().subscription,
      sessionId: retentionFlow().session_id,
      workspaceId: 'workspace-1',
      isScopeCurrent: expect.any(Function)
    })
    expect(
      workspaceApi.recordRetentionFlowEvent
    ).toHaveBeenCalledExactlyOnceWith({
      session_id: retentionFlow().session_id,
      event: 'flow_opened'
    })
  })

  it('stops when the active workspace changes during preparation', async () => {
    vi.mocked(workspaceApi.prepareRetentionFlow).mockImplementation(
      async () => {
        mocks.activeWorkspaceId = 'workspace-2'
        return retentionFlow({ experiment_variant: offer.id, offer })
      }
    )
    const showFallback = vi.fn()
    const showRetentionOffer = decides('dismissed')

    await launchCancellationFlow({ showFallback, showRetentionOffer })

    expect(showFallback).not.toHaveBeenCalled()
    expect(showRetentionOffer).not.toHaveBeenCalled()
  })

  it('continues to the standard dialog without reopening the flow', async () => {
    offersRetention()
    const showFallback = vi.fn()

    await launchCancellationFlow({
      showFallback,
      showRetentionOffer: decides('continueToCancel')
    })

    expect(showFallback).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ flowAlreadyOpened: true })
    )
  })

  it('falls back to the standard dialog when the offer cannot open', async () => {
    offersRetention()
    const error = new Error('chunk unavailable')
    const showFallback = vi.fn()

    await launchCancellationFlow({
      showFallback,
      showRetentionOffer: vi.fn().mockRejectedValue(error)
    })

    expect(reportError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ errorType: 'retention_offer_dialog_failed' })
    )
    expect(showFallback).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ flowAlreadyOpened: true })
    )
  })

  it('warns that a discount still being confirmed may land', async () => {
    offersRetention()
    const showFallback = vi.fn()

    await launchCancellationFlow({
      showFallback,
      showRetentionOffer: decides('pending')
    })

    expect(showFallback).not.toHaveBeenCalled()
    expect(useToastStore().add).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        severity: 'warn',
        summary: 'subscription.retentionOffer.pendingToast'
      })
    )
  })

  describe('cancel flow billing events', () => {
    const intent = {
      operation: 'cancel',
      stage: 'intent',
      outcome: 'pending',
      current_tier: 'pro',
      cycle: 'yearly'
    }
    const abandoned = { ...intent, stage: 'abandoned' }

    function reportedCancelEvents() {
      return vi
        .mocked(useTelemetry()!.trackBillingEvent)
        .mock.calls.filter(([event]) => event.operation === 'cancel')
        .map(([event]) => event)
    }

    it.for<{ outcome: RetentionOfferOutcome; reported: object[] }>([
      { outcome: 'dismissed', reported: [intent, abandoned] },
      { outcome: 'retained', reported: [intent] },
      { outcome: 'pending', reported: [intent] },
      { outcome: 'continueToCancel', reported: [intent] }
    ])('reports a $outcome offer as its cancel events', async (row) => {
      offersRetention()

      await launchCancellationFlow({
        showFallback: vi.fn(),
        showRetentionOffer: decides(row.outcome)
      })

      expect(reportedCancelEvents()).toEqual(row.reported)
    })

    it('reaches Datadog as billing actions', async () => {
      const registry = new TelemetryRegistry()
      registry.registerProvider(new DatadogRumTelemetryProvider())
      vi.mocked(useTelemetry).mockReturnValue(registry)
      offersRetention()

      await launchCancellationFlow({
        showFallback: vi.fn(),
        showRetentionOffer: decides('dismissed')
      })

      expect(mockRumAddAction.mock.calls).toEqual([
        ['billing.cancel.intent', { ...intent, billing_surface: 'cloud_app' }],
        [
          'billing.cancel.abandoned',
          { ...abandoned, billing_surface: 'cloud_app' }
        ]
      ])
    })
  })
})
