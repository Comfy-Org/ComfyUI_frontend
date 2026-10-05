import { computed, nextTick, ref } from 'vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import type { SubscriptionInfo } from '@/composables/billing/types'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@/platform/telemetry'
import { PaymentPopupBlockedError } from '@/platform/telemetry/utils/billingFailureCategory'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useDialogStore } from '@/stores/dialogStore'

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

const mockToastAdd = vi.hoisted(() => vi.fn())

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

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/composables/billing/useBillingRouting'))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

vi.mock(import('@/platform/telemetry'))

vi.mock<unknown>(
  import('primevue/usetoast'), // oxlint-disable-line comfy/no-primevue-imports

  () => ({
    useToast: vi.fn(() => ({
      add: mockToastAdd
    }))
  })
)

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
    const permissions = useWorkspaceUI().permissions.value
    vi.mocked(useWorkspaceUI()).permissions = computed(() => ({
      ...permissions,
      canManageSubscriptionLifecycle: mockCanManageSubscriptionLifecycle.value
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
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

      await waitFor(() =>
        expect(useDialogStore().closeDialog).toHaveBeenCalled()
      )
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
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

      expect(useBillingContext().cancelSubscription).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warn',
          summary: 'Your active workspace changed. Switch back and try again.'
        })
      )
      expect(closeDialog).toHaveBeenCalledWith({ key: 'cancel-subscription' })
      view.unmount()
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('abandoned', expect.anything())
    })

    it('tracks failed without confirmed for a legacy cancel that rejects', async () => {
      setSubscription(null)
      vi.mocked(useBillingContext().cancelSubscription).mockRejectedValueOnce({
        message: 'timed out'
      })

      renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel subscription$/i })
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
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

      await waitFor(() =>
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'error' })
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
        screen.getByRole('button', { name: /keep subscription/i })
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
      userEvent.click(
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )
    const keep = () =>
      userEvent.click(
        screen.getByRole('button', { name: /keep subscription/i })
      )
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
        name: 'a legacy cancel that fails',
        arrange: cancelFailsOn(false),
        act: confirm,
        reported: [intent, failed]
      },
      {
        name: 'a legacy cancel that fails before the customer leaves',
        arrange: cancelFailsOn(false),
        act: async () => {
          await confirm()
          await waitFor(() =>
            expect(mockToastAdd).toHaveBeenCalledWith(
              expect.objectContaining({ severity: 'error' })
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
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

      await waitFor(() =>
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'error',
            detail: 'Subscription cancellation timed out'
          })
        )
      )
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    })

    it('closes the dialog and shows a success toast when cancellation succeeds', async () => {
      setSubscription(null)
      mockShouldUseWorkspaceBilling.value = true
      vi.mocked(useBillingContext().cancelSubscription).mockResolvedValueOnce(
        undefined
      )

      renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

      await waitFor(() =>
        expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
          key: 'cancel-subscription'
        })
      )
      expect(useBillingContext().fetchStatus).toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })

    it('does not cancel after the workspace role loses permission', async () => {
      const canCancel = ref(true)
      useBillingCapabilities().canCancel = computed(() => canCancel.value)

      setSubscription(null)
      mockShouldUseWorkspaceBilling.value = true

      renderComponent()
      canCancel.value = false
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

      expect(useBillingContext().cancelSubscription).not.toHaveBeenCalled()
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('confirmed', expect.anything())
      expect(mockToastAdd).not.toHaveBeenCalled()
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
        screen.getByRole('button', { name: /^cancel subscription$/i })
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
        screen.getByRole('button', { name: /^cancel subscription$/i })
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
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

      await waitFor(() =>
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'success' })
        )
      )
      expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
        key: 'cancel-subscription'
      })
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
  })

  describe('legacy rail portal cancel', () => {
    const confirm = () =>
      userEvent.click(
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )
    const confirmedCalls = () =>
      vi
        .mocked(useTelemetry()!.trackSubscriptionCancellation)
        .mock.calls.filter(([stage]) => stage === 'confirmed')

    it('asks the user to finish on Stripe and claims no success', async () => {
      setSubscription(subscription())
      vi.mocked(useBillingContext().cancelSubscription).mockResolvedValueOnce(
        undefined
      )

      renderComponent()
      await confirm()

      expect(
        await screen.findByText(/Finish cancelling on the Stripe page/i)
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^cancel subscription$/i })
      ).not.toBeInTheDocument()
      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
      expect(confirmedCalls()).toHaveLength(0)
    })

    it('shows success and tracks confirmed only once the cancel is observed', async () => {
      const isCancelled = ref(false)
      useBillingContext().subscription = computed(() =>
        subscription({ isCancelled: isCancelled.value })
      )
      vi.mocked(useBillingContext().cancelSubscription).mockResolvedValueOnce(
        undefined
      )

      const { unmount } = renderComponent()
      await confirm()
      await screen.findByText(/Finish cancelling on the Stripe page/i)

      isCancelled.value = true

      await waitFor(() =>
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'success',
            summary: 'Subscription cancelled successfully'
          })
        )
      )
      expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
        key: 'cancel-subscription'
      })
      expect(confirmedCalls()).toHaveLength(1)
      unmount()
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('abandoned', expect.anything())
    })

    async function confirmWith(isCancelled: { value: boolean }, props = {}) {
      useBillingContext().subscription = computed(() =>
        subscription({ isCancelled: isCancelled.value })
      )
      vi.mocked(useBillingContext().cancelSubscription).mockResolvedValueOnce(
        undefined
      )
      const view = renderComponent(props)
      await confirm()
      await screen.findByText(/Finish cancelling on the Stripe page/i)
      return view
    }

    it('does not report success when the workspace changed and another workspace was cancelled', async () => {
      const isCancelled = ref(false)
      const scopeCurrent = ref(true)
      await confirmWith(isCancelled, {
        isScopeCurrent: () => scopeCurrent.value
      })

      scopeCurrent.value = false
      isCancelled.value = true

      await waitFor(() =>
        expect(useDialogStore().closeDialog).toHaveBeenCalled()
      )
      expect(mockToastAdd).toHaveBeenCalledTimes(1)
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' })
      )
      expect(confirmedCalls()).toHaveLength(0)
    })

    it('does not report success for a subscription already cancelled at confirm', async () => {
      const isCancelled = ref(true)
      await confirmWith(isCancelled)

      await nextTick()

      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(confirmedCalls()).toHaveLength(0)
    })

    it('completes when the cancel is observed while the portal call is pending', async () => {
      const isCancelled = ref(false)
      useBillingContext().subscription = computed(() =>
        subscription({ isCancelled: isCancelled.value })
      )
      let resolvePortal!: () => void
      vi.mocked(useBillingContext().cancelSubscription).mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolvePortal = resolve
        })
      )

      renderComponent()
      await confirm()
      isCancelled.value = true
      await nextTick()
      resolvePortal()

      await waitFor(() =>
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'success' })
        )
      )
      expect(confirmedCalls()).toHaveLength(1)
      expect(mockToastAdd).toHaveBeenCalledTimes(1)
      expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
        key: 'cancel-subscription'
      })
    })

    it('does not report success when a pre-existing cancel loads after a null status at confirm', async () => {
      const status = ref<SubscriptionInfo | null>(null)
      useBillingContext().subscription = computed(() => status.value)
      vi.mocked(useBillingContext().cancelSubscription).mockResolvedValueOnce(
        undefined
      )
      renderComponent()
      await confirm()
      await screen.findByText(/Finish cancelling on the Stripe page/i)

      status.value = subscription({ isCancelled: true })
      await nextTick()

      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(confirmedCalls()).toHaveLength(0)
    })

    it('reports a cancel that turns true after the status was un-cancelled', async () => {
      const isCancelled = ref(true)
      await confirmWith(isCancelled)

      isCancelled.value = false
      await nextTick()
      isCancelled.value = true

      await waitFor(() => expect(confirmedCalls()).toHaveLength(1))
    })

    it('sends confirmed exactly once when isCancelled flips repeatedly', async () => {
      const isCancelled = ref(false)
      await confirmWith(isCancelled)

      isCancelled.value = true
      await nextTick()
      isCancelled.value = false
      await nextTick()
      isCancelled.value = true
      await nextTick()

      expect(confirmedCalls()).toHaveLength(1)
      expect(mockToastAdd).toHaveBeenCalledTimes(1)
    })

    it('refreshes status on window focus while awaiting Stripe', async () => {
      await confirmWith(ref(false))
      vi.mocked(useBillingContext().fetchStatus).mockClear()

      window.dispatchEvent(new Event('focus'))

      expect(useBillingContext().fetchStatus).toHaveBeenCalledTimes(1)
    })

    it('takes the scope-change path, not failed, when the workspace changed during a failing portal call', async () => {
      setSubscription(subscription())
      const scopeCurrent = ref(true)
      vi.mocked(useBillingContext().cancelSubscription).mockImplementationOnce(
        () => {
          scopeCurrent.value = false
          return Promise.reject(new Error('boom'))
        }
      )

      renderComponent({ isScopeCurrent: () => scopeCurrent.value })
      await confirm()

      await waitFor(() =>
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'warn' })
        )
      )
      expect(mockToastAdd).not.toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).not.toHaveBeenCalledWith('failed', expect.anything())
    })

    it('reports a blocked portal tab as failed with an error toast and no confirmed', async () => {
      setSubscription(subscription())
      vi.mocked(useBillingContext().cancelSubscription).mockRejectedValueOnce(
        new PaymentPopupBlockedError('blocked')
      )

      renderComponent()
      await confirm()

      await waitFor(() =>
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'error' })
        )
      )
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).toHaveBeenCalledWith('failed', expect.anything())
      expect(confirmedCalls()).toHaveLength(0)
    })

    it('reports abandoned, not confirmed, when closed before the cancel is observed', async () => {
      setSubscription(subscription())
      vi.mocked(useBillingContext().cancelSubscription).mockResolvedValueOnce(
        undefined
      )

      const { unmount } = renderComponent()
      await confirm()
      await screen.findByText(/Finish cancelling on the Stripe page/i)
      await userEvent.click(
        screen.getAllByRole('button', { name: /^close$/i }).at(-1)!
      )
      unmount()

      expect(confirmedCalls()).toHaveLength(0)
      expect(
        useTelemetry()?.trackSubscriptionCancellation
      ).toHaveBeenCalledWith('abandoned', expect.anything())
    })
  })

  describe('legacy rail portal cancel while the call is pending', () => {
    const confirm = () =>
      userEvent.click(
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

    function pendingPortal() {
      let resolvePortal!: () => void
      vi.mocked(useBillingContext().cancelSubscription).mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolvePortal = resolve
        })
      )
      return () => resolvePortal()
    }

    function terminalEvents() {
      return vi
        .mocked(useTelemetry()!.trackSubscriptionCancellation)
        .mock.calls.filter(([stage]) =>
          ['confirmed', 'abandoned', 'failed'].includes(stage)
        )
    }

    it('aborts instead of reporting success when the workspace switches to workspace billing mid-call', async () => {
      setSubscription(subscription())
      const scopeCurrent = ref(true)
      const resolvePortal = pendingPortal()

      renderComponent({ isScopeCurrent: () => scopeCurrent.value })
      await confirm()
      scopeCurrent.value = false
      mockShouldUseWorkspaceBilling.value = true
      resolvePortal()

      await waitFor(() =>
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'warn' })
        )
      )
      expect(mockToastAdd).toHaveBeenCalledTimes(1)
      expect(terminalEvents()).toHaveLength(0)
    })

    it('aborts instead of reporting success when dismissed, then switched, before the call resolves', async () => {
      setSubscription(subscription())
      const scopeCurrent = ref(true)
      const resolvePortal = pendingPortal()

      const { unmount } = renderComponent({
        isScopeCurrent: () => scopeCurrent.value
      })
      await confirm()
      unmount()
      scopeCurrent.value = false
      mockShouldUseWorkspaceBilling.value = true
      resolvePortal()

      await waitFor(() =>
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'warn' })
        )
      )
      expect(mockToastAdd).not.toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
      expect(terminalEvents()).toHaveLength(0)
    })

    it('reports exactly one abandoned when dismissed while the call is pending', async () => {
      setSubscription(subscription())
      const resolvePortal = pendingPortal()

      const { unmount } = renderComponent()
      await confirm()
      unmount()
      expect(terminalEvents()).toHaveLength(0)
      resolvePortal()

      await waitFor(() => expect(terminalEvents()).toHaveLength(1))
      expect(terminalEvents()[0][0]).toBe('abandoned')
    })
  })

  describe('formattedEndDate fallbacks', () => {
    it('uses the localized fallback when no cancel timestamp is available', () => {
      setSubscription(subscription())
      renderComponent()

      expect(screen.getByText(/end of billing period/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('uses the localized fallback when the timestamp is unparseable', () => {
      setSubscription(subscription({ endDate: 'not-a-real-date' }))
      renderComponent({ cancelAt: 'also-not-a-date' })

      expect(screen.getByText(/end of billing period/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })
  })

  describe('strict ISO 8601 parsing on Safari/WebView-style runtimes', () => {
    it('renders cancelAt with 4-digit fractional seconds', () => {
      setSubscription(null)

      withStrictMillisecondParser(() => {
        renderComponent({ cancelAt: '2026-04-18T10:04:55.6513Z' })
      })

      expect(screen.getByText(/April 18, 2026/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('renders cancelAt with 1-digit fractional seconds', () => {
      setSubscription(null)

      withStrictMillisecondParser(() => {
        renderComponent({ cancelAt: '2026-04-18T10:04:55.6Z' })
      })

      expect(screen.getByText(/April 18, 2026/)).toBeInTheDocument()
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

      expect(screen.getByText(/April 18, 2026/)).toBeInTheDocument()
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

      expect(screen.getByText(/April 18, 2026/)).toBeInTheDocument()
      expect(screen.queryByText(/January 1, 2030/)).not.toBeInTheDocument()
    })
  })
})
