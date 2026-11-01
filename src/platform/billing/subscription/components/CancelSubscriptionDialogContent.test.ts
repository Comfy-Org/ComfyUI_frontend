import { computed, ref } from 'vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingRouting } from '@/platform/billing/composables/useBillingRouting'
import type { SubscriptionInfo } from '@/platform/billing/composables/types'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingUI } from '@/platform/billing/composables/useBillingUI'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@comfyorg/telemetry'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useDialogStore } from '@/stores/dialogStore'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'

import CancelSubscriptionDialogContent from './CancelSubscriptionDialogContent.vue'

const isoFractionalSecondsPattern = /\.(\d+)(?=Z|[+-]\d{2}:?\d{2}|$)/

function withStrictMillisecondParser<T>(run: () => T): T {
  const RealDate = Date

  class StrictDate extends RealDate {
    constructor(value?: string | number | Date) {
      if (arguments.length === 0) {
        super()
        return
      }

      if (typeof value === 'string') {
        const fractionalSeconds = value.match(isoFractionalSecondsPattern)?.[1]
        if (fractionalSeconds && fractionalSeconds.length !== 3) {
          super(Number.NaN)
          return
        }
      }

      super(value as string | number)
    }
  }

  vi.stubGlobal('Date', StrictDate)

  try {
    return run()
  } finally {
    vi.unstubAllGlobals()
  }
}

const mockShouldUseWorkspaceBilling = vi.hoisted(() => ({ value: false }))

const mockCanManageSubscriptionLifecycle = vi.hoisted(() => ({ value: true }))
const mockDistributionTypes = vi.hoisted(() => ({ isCloud: true }))

function subscription(
  overrides: Partial<SubscriptionInfo> = {}
): SubscriptionInfo {
  return {
    isActive: true,
    tier: 'STANDARD',
    duration: null,
    planSlug: null,
    scheduledChange: null,
    renewalDate: null,
    endDate: null,
    isCancelled: false,
    hasFunds: true,
    agentHasFunds: true,
    ...overrides
  }
}

function setSubscription(value: SubscriptionInfo | null) {
  useBillingContext().subscription = computed(() => value)
}

vi.mock(import('@/platform/billing/composables/useBillingContext'))

vi.mock(import('@/platform/billing/composables/useBillingRouting'))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

vi.mock(import('@/platform/billing/composables/useBillingUI'))

vi.mock(import('@comfyorg/telemetry'))

function renderComponent(
  props: {
    cancelAt?: string
    flowAlreadyOpened?: boolean
    flowAlreadyConfirmed?: boolean
    isScopeCurrent?: () => boolean
  } = {}
) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  return render(CancelSubscriptionDialogContent, {
    props,
    global: {
      plugins: [i18n]
    }
  })
}

describe('CancelSubscriptionDialogContent', () => {
  beforeEach(() => {
    const billing = vi.mocked(useBillingContext())
    billing.subscription = computed(() => null)
    billing.tier = computed(() => 'STANDARD')
    vi.mocked(useBillingContext).mockReturnValue(billing)
    useBillingRouting().shouldUseWorkspaceBilling = computed(
      () => mockShouldUseWorkspaceBilling.value
    )
    const permissions = useBillingUI().permissions.value
    vi.mocked(useBillingUI()).permissions = computed(() => ({
      ...permissions,
      canManageSubscriptionLifecycle: receiveServerFact(
        'can_manage_subscription',
        mockCanManageSubscriptionLifecycle.value
      )
    }))
    mockShouldUseWorkspaceBilling.value = false
    useBillingCapabilities().canCancel = computed(() => true)
    mockCanManageSubscriptionLifecycle.value = true
    mockDistributionTypes.isCloud = true
  })

  describe('cancellation telemetry', () => {
    it('tracks flow_opened with tier and end date when the dialog mounts', () => {
      setSubscription(
        subscription({
          duration: 'ANNUAL',
          endDate: '2026-08-01T00:00:00.000Z'
        })
      )

      renderComponent()

      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).toHaveBeenCalledWith('flow_opened', {
        source: 'cancel_plan_menu',
        current_tier: 'standard',
        cycle: 'yearly',
        end_date: '2026-08-01T00:00:00.000Z'
      })
    })

    it('does not repeat flow_opened when continuing a fallback flow', () => {
      setSubscription(null)

      renderComponent({ flowAlreadyOpened: true })

      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('flow_opened', expect.anything())
    })

    it('tracks confirmed before the cancel request and no abandoned on success', async () => {
      setSubscription(null)
      mockShouldUseWorkspaceBilling.value = true
      vi.mocked(useBillingContext().cancelSubscription).mockResolvedValueOnce(
        undefined
      )

      const { unmount } = renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel my plan$/i })
      )

      await screen.findByRole('heading', { name: 'Your plan is cancelled' })
      unmount()
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).toHaveBeenCalledWith(
        'confirmed',
        expect.objectContaining({ current_tier: 'standard' })
      )
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('abandoned', expect.anything())
    })

    it('does not cancel when the workspace scope changed after opening', async () => {
      setSubscription(null)
      const closeDialog = vi.spyOn(useDialogStore(), 'closeDialog')
      const view = renderComponent({ isScopeCurrent: () => false })

      await userEvent.click(
        screen.getByRole('button', { name: /^cancel my plan$/i })
      )

      expect(useBillingContext().cancelSubscription).not.toHaveBeenCalled()
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'warning',
          title: 'Your active workspace changed. Switch back and try again.'
        })
      )
      expect(closeDialog).toHaveBeenCalledWith({ key: 'cancel-subscription' })
      view.unmount()
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('abandoned', expect.anything())
    })

    it('tracks failed without confirmed for a cancel that rejects before routing is known', async () => {
      setSubscription(null)
      vi.mocked(useBillingContext().cancelSubscription).mockRejectedValueOnce({
        message: 'timed out'
      })

      renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel my plan$/i })
      )

      await waitFor(() =>
        expect(
          useTelemetry()?.trackSubscriptionCancellation
        ).toHaveBeenCalledWith(
          'failed',
          expect.not.objectContaining({ error_message: expect.anything() })
        )
      )
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('confirmed', expect.anything())
    })

    it('leaves workspace terminal failure telemetry to the billing poller', async () => {
      setSubscription(null)
      mockShouldUseWorkspaceBilling.value = true
      vi.mocked(useBillingContext().cancelSubscription).mockRejectedValueOnce({
        message: 'timed out'
      })

      renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel my plan$/i })
      )

      await waitFor(() =>
        expect(useToast().toasts).toContainEqual(
          expect.objectContaining({ kind: 'error' })
        )
      )
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('failed', expect.anything())
    })

    it('tracks abandoned when the user keeps the subscription', async () => {
      setSubscription(null)

      const { unmount } = renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /keep my plan/i })
      )

      expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
        key: 'cancel-subscription'
      })
      unmount()
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).toHaveBeenCalledWith(
        'abandoned',
        expect.objectContaining({ current_tier: 'standard' })
      )
      expect(useBillingContext().cancelSubscription).not.toHaveBeenCalled()
    })

    it('tracks abandoned when the dialog is dismissed by the shell', () => {
      setSubscription(null)

      const { unmount } = renderComponent()
      vi.mocked(useTelemetry()?.trackSubscriptionCancellation)?.mockClear()
      unmount()

      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).toHaveBeenCalledWith(
        'abandoned',
        expect.objectContaining({ current_tier: 'standard' })
      )
    })
  })

  describe('cancel flow billing events', () => {
    const intent = {
      operation: 'cancel',
      stage: 'intent',
      outcome: 'pending',
      current_tier: 'standard'
    }
    const abandoned = {
      operation: 'cancel',
      stage: 'abandoned',
      outcome: 'pending',
      current_tier: 'standard'
    }
    const failed = {
      operation: 'cancel',
      stage: 'failed',
      outcome: 'failure',
      failure_category: 'unknown',
      current_tier: 'standard'
    }
    const confirm = () =>
      userEvent.click(screen.getByRole('button', { name: /^cancel my plan$/i }))
    const keep = () =>
      userEvent.click(screen.getByRole('button', { name: /keep my plan/i }))
    const cancelFailsOn = (workspaceRail: boolean) => () => {
      mockShouldUseWorkspaceBilling.value = workspaceRail
      vi.mocked(useBillingContext().cancelSubscription).mockRejectedValue({
        message: 'timed out'
      })
    }

    it.for<{
      name: string
      arrange: () => void
      props?: {
        flowAlreadyOpened?: boolean
        flowAlreadyConfirmed?: boolean
        isScopeCurrent?: () => boolean
      }
      act: () => Promise<unknown>
      reported: object[]
    }>([
      {
        name: 'keeping the subscription',
        arrange: () => {},
        act: keep,
        reported: [intent, abandoned]
      },
      {
        name: 'keeping the subscription after the provider opened the flow',
        arrange: () => {},
        props: { flowAlreadyOpened: true },
        act: keep,
        reported: [abandoned]
      },
      {
        name: 'keeping the subscription after the provider flow the customer confirmed',
        arrange: () => {},
        props: { flowAlreadyOpened: true, flowAlreadyConfirmed: true },
        act: keep,
        reported: []
      },
      {
        name: 'a workspace cancel that goes through',
        arrange: () => {
          mockShouldUseWorkspaceBilling.value = true
        },
        act: confirm,
        reported: [intent]
      },
      {
        name: 'a workspace cancel that fails, which its operation reports',
        arrange: cancelFailsOn(true),
        act: confirm,
        reported: [intent]
      },
      {
        name: 'a cancel before routing is known that fails',
        arrange: cancelFailsOn(false),
        act: confirm,
        reported: [intent, failed]
      },
      {
        name: 'a cancel before routing is known that fails before the customer leaves',
        arrange: cancelFailsOn(false),
        act: async () => {
          await confirm()
          await waitFor(() =>
            expect(useToast().toasts).toContainEqual(
              expect.objectContaining({ kind: 'error' })
            )
          )
          await keep()
        },
        reported: [intent, failed]
      },
      {
        name: 'a confirm after the workspace changed',
        arrange: () => {},
        props: { isScopeCurrent: () => false },
        act: confirm,
        reported: [intent]
      }
    ])('reports $name as its cancel events', async (row) => {
      setSubscription(null)
      row.arrange()

      const { unmount } = renderComponent(row.props)
      await row.act()
      unmount()

      expect(
        vi
          .mocked(useTelemetry()!.trackBillingEvent)
          .mock.calls.filter(([event]) => event.operation === 'cancel')
          .map(([event]) => event)
      ).toEqual(row.reported)
    })
  })

  describe('cancel flow', () => {
    it('shows an error toast and keeps the dialog open when cancellation fails', async () => {
      setSubscription(null)
      vi.mocked(useBillingContext().cancelSubscription).mockRejectedValueOnce(
        new Error('Subscription cancellation timed out')
      )

      renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel my plan$/i })
      )

      await waitFor(() =>
        expect(useToast().toasts).toContainEqual(
          expect.objectContaining({
            kind: 'error',
            description: 'Subscription cancellation timed out'
          })
        )
      )
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    })

    it('shows the cancelled plan until the owner is done when cancellation succeeds', async () => {
      setSubscription(subscription({ endDate: '2026-11-12T12:00:00.000Z' }))
      mockShouldUseWorkspaceBilling.value = true
      vi.mocked(useBillingContext().cancelSubscription).mockResolvedValueOnce(
        undefined
      )

      renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel my plan$/i })
      )

      expect(
        await screen.findByRole('heading', { name: 'Your plan is cancelled' })
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          "Your Standard plan stays active until November 12, 2026, and you won't be charged again. You can resubscribe anytime."
        )
      ).toBeInTheDocument()
      expect(useBillingContext().fetchStatus).toHaveBeenCalled()
      expect(useToast().toasts).toEqual([])
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()

      await userEvent.click(screen.getByRole('button', { name: 'Done' }))

      expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
        key: 'cancel-subscription'
      })
    })

    it('does not cancel after the workspace role loses permission', async () => {
      const canCancel = ref(true)
      useBillingCapabilities().canCancel = computed(() => canCancel.value)

      setSubscription(null)
      mockShouldUseWorkspaceBilling.value = true

      renderComponent()
      canCancel.value = false
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel my plan$/i })
      )

      expect(useBillingContext().cancelSubscription).not.toHaveBeenCalled()
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('confirmed', expect.anything())
      expect(useToast().toasts).toEqual([])
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    })

    it('cancels off Cloud on the workspace permission, ignoring the Cloud-only capability', async () => {
      setSubscription(null)
      mockShouldUseWorkspaceBilling.value = true
      mockDistributionTypes.isCloud = false
      useBillingCapabilities().canCancel = computed(() => false)
      mockCanManageSubscriptionLifecycle.value = true
      vi.mocked(useBillingContext().cancelSubscription).mockResolvedValueOnce(
        undefined
      )

      renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel my plan$/i })
      )

      await waitFor(() =>
        expect(useBillingContext().cancelSubscription).toHaveBeenCalled()
      )
    })

    it('blocks cancelling off Cloud when the workspace permission is missing', async () => {
      setSubscription(null)
      mockShouldUseWorkspaceBilling.value = true
      mockDistributionTypes.isCloud = false
      mockCanManageSubscriptionLifecycle.value = false

      renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel my plan$/i })
      )

      expect(useBillingContext().cancelSubscription).not.toHaveBeenCalled()
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('confirmed', expect.anything())
    })

    it('does not track cancellation failure when status refresh fails after cancellation succeeds', async () => {
      setSubscription(null)
      mockShouldUseWorkspaceBilling.value = true
      vi.mocked(useBillingContext().cancelSubscription).mockResolvedValueOnce(
        undefined
      )
      vi.mocked(useBillingContext().fetchStatus).mockRejectedValueOnce(
        new Error('Refresh failed')
      )

      const { unmount } = renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel my plan$/i })
      )

      await screen.findByRole('heading', { name: 'Your plan is cancelled' })
      expect(
        vi
          .mocked(useTelemetry()?.trackSubscriptionCancellation)
          ?.mock.calls.some(([stage]) => stage === 'failed')
      ).toBe(false)

      unmount()
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('abandoned', expect.anything())
    })

    it('takes the scope-change path, not failed, when the workspace changed during a failing cancel call', async () => {
      setSubscription(subscription())
      const scopeCurrent = ref(true)
      vi.mocked(useBillingContext().cancelSubscription).mockImplementationOnce(
        () => {
          scopeCurrent.value = false
          return Promise.reject(new Error('boom'))
        }
      )

      renderComponent({ isScopeCurrent: () => scopeCurrent.value })
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel my plan$/i })
      )

      await waitFor(() =>
        expect(useToast().toasts).toContainEqual(
          expect.objectContaining({ kind: 'warning' })
        )
      )
      expect(useToast().toasts).not.toContainEqual(
        expect.objectContaining({ kind: 'error' })
      )
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('failed', expect.anything())
    })
  })

  describe('formattedEndDate fallbacks', () => {
    it('uses the localized fallback when no cancel timestamp is available', () => {
      setSubscription(subscription())
      renderComponent()

      expect(
        screen.getAllByText(/the end of your billing period/)
      ).toHaveLength(2)
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('uses the localized fallback when the timestamp is unparseable', () => {
      setSubscription(subscription({ endDate: 'not-a-real-date' }))
      renderComponent({ cancelAt: 'also-not-a-date' })

      expect(
        screen.getAllByText(/the end of your billing period/)
      ).toHaveLength(2)
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })
  })

  describe('strict ISO 8601 parsing on Safari/WebView-style runtimes', () => {
    it('renders cancelAt with 4-digit fractional seconds', () => {
      setSubscription(null)

      withStrictMillisecondParser(() => {
        renderComponent({ cancelAt: '2026-04-18T10:04:55.6513Z' })
      })

      expect(screen.getAllByText(/April 18, 2026/)).toHaveLength(2)
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('renders cancelAt with 1-digit fractional seconds', () => {
      setSubscription(null)

      withStrictMillisecondParser(() => {
        renderComponent({ cancelAt: '2026-04-18T10:04:55.6Z' })
      })

      expect(screen.getAllByText(/April 18, 2026/)).toHaveLength(2)
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('renders subscription.endDate with 4-digit fractional seconds when cancelAt is absent', () => {
      setSubscription(
        subscription({
          endDate: '2026-04-18T10:04:55.6513Z'
        })
      )

      withStrictMillisecondParser(() => {
        renderComponent()
      })

      expect(screen.getAllByText(/April 18, 2026/)).toHaveLength(2)
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('prefers cancelAt prop over subscription.endDate when both are set', () => {
      setSubscription(
        subscription({
          endDate: '2030-01-01T00:00:00.000Z'
        })
      )

      withStrictMillisecondParser(() => {
        renderComponent({ cancelAt: '2026-04-18T10:04:55.6513Z' })
      })

      expect(screen.getAllByText(/April 18, 2026/)).toHaveLength(2)
      expect(screen.queryByText(/January 1, 2030/)).not.toBeInTheDocument()
    })

    it('uses the renewal date of an active plan that has no end date', () => {
      setSubscription(subscription({ renewalDate: '2026-11-05T12:00:00.000Z' }))

      renderComponent()

      expect(screen.getAllByText(/November 5, 2026/)).toHaveLength(2)
      expect(
        screen.queryByText(/the end of your billing period/)
      ).not.toBeInTheDocument()
    })
  })

  describe('confirmation', () => {
    it('lists what the plan loses at the end of the billing period', () => {
      setSubscription(
        subscription({
          duration: 'MONTHLY',
          endDate: '2026-11-12T12:00:00.000Z'
        })
      )

      renderComponent()

      expect(
        screen.getByRole('heading', { name: 'Cancel your plan?' })
      ).toBeInTheDocument()
      expect(
        screen.getByText("After November 12, 2026, you'll lose access to:")
      ).toBeInTheDocument()
      expect(
        screen.getAllByRole('listitem').map((item) => item.textContent)
      ).toEqual([
        expect.stringContaining('Cloud GPUs'),
        expect.stringContaining('Every model, one balance'),
        expect.stringContaining('Custom nodes, ready'),
        expect.stringContaining('4,200 monthly credits')
      ])
    })

    it('names no credit amount when the plan grant is unknown', () => {
      setSubscription(subscription({ duration: null }))

      renderComponent()

      expect(screen.getByText('Monthly credits')).toBeInTheDocument()
    })
  })
})
