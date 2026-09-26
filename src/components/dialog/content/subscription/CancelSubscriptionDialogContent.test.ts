import { computed, ref } from 'vue'
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
  props: { cancelAt?: string; flowAlreadyOpened?: boolean } = {}
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

    it('tracks confirmed and failed with message-carrying rejection values', async () => {
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
      ).toHaveBeenCalledWith('confirmed', expect.anything())
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
