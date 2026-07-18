import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

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

  vi.stubGlobal('Date', StrictDate as DateConstructor)

  try {
    return run()
  } finally {
    vi.unstubAllGlobals()
  }
}

const mockSubscription = vi.hoisted(() => ({
  value: null as {
    endDate: string | null
    duration?: 'ANNUAL' | 'MONTHLY' | null
  } | null
}))

const mockCancelSubscription = vi.hoisted(() => vi.fn())
const mockFetchStatus = vi.hoisted(() => vi.fn())
const mockCloseDialog = vi.hoisted(() => vi.fn())
const mockToastAdd = vi.hoisted(() => vi.fn())
const mockTier = vi.hoisted(() => ({ value: 'STANDARD' as string | null }))
const mockTrackCancellation = vi.hoisted(() => vi.fn())
const mockShouldUseWorkspaceBilling = vi.hoisted(() => ({ value: false }))
const mockCanManageSubscriptionLifecycle = vi.hoisted(() => ({ value: true }))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: vi.fn(() => ({
    cancelSubscription: mockCancelSubscription,
    fetchStatus: mockFetchStatus,
    subscription: mockSubscription,
    tier: mockTier
  }))
}))

vi.mock('@/composables/billing/useBillingRouting', () => ({
  useBillingRouting: () => ({
    shouldUseWorkspaceBilling: mockShouldUseWorkspaceBilling
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: {
      get value() {
        return {
          canManageSubscriptionLifecycle:
            mockCanManageSubscriptionLifecycle.value
        }
      }
    }
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackSubscriptionCancellation: mockTrackCancellation
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: vi.fn(() => ({
    closeDialog: mockCloseDialog
  }))
}))

vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({
    add: mockToastAdd
  }))
}))

function renderComponent(props: { cancelAt?: string } = {}) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  return render(CancelSubscriptionDialogContent, {
    props,
    global: {
      plugins: [i18n],
      stubs: {
        Button: {
          template: '<button :disabled="disabled"><slot /></button>',
          props: ['disabled', 'variant', 'size', 'loading']
        }
      }
    }
  })
}

describe('CancelSubscriptionDialogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTier.value = 'STANDARD'
    mockShouldUseWorkspaceBilling.value = false
    mockCanManageSubscriptionLifecycle.value = true
  })

  describe('cancellation telemetry', () => {
    it('tracks flow_opened with tier and end date when the dialog mounts', () => {
      mockSubscription.value = { endDate: '2026-08-01T00:00:00.000Z' }

      renderComponent()

      expect(mockTrackCancellation).toHaveBeenCalledWith('flow_opened', {
        source: 'cancel_plan_menu',
        current_tier: 'standard',
        end_date: '2026-08-01T00:00:00.000Z'
      })
    })

    it('tracks confirmed before the cancel request and no abandoned on success', async () => {
      mockSubscription.value = null
      mockCancelSubscription.mockResolvedValueOnce(undefined)

      const { unmount } = renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

      await waitFor(() => expect(mockCloseDialog).toHaveBeenCalled())
      unmount()
      expect(mockTrackCancellation).toHaveBeenCalledWith(
        'confirmed',
        expect.objectContaining({ current_tier: 'standard' })
      )
      expect(mockTrackCancellation).not.toHaveBeenCalledWith(
        'abandoned',
        expect.anything()
      )
    })

    it('tracks confirmed and failed with message-carrying rejection values', async () => {
      mockSubscription.value = null
      mockCancelSubscription.mockRejectedValueOnce({ message: 'timed out' })

      renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

      await waitFor(() =>
        expect(mockTrackCancellation).toHaveBeenCalledWith(
          'failed',
          expect.objectContaining({ error_message: 'timed out' })
        )
      )
      expect(mockTrackCancellation).toHaveBeenCalledWith(
        'confirmed',
        expect.anything()
      )
    })

    it('tracks abandoned when the user keeps the subscription', async () => {
      mockSubscription.value = null

      const { unmount } = renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /keep subscription/i })
      )

      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'cancel-subscription'
      })
      unmount()
      expect(mockTrackCancellation).toHaveBeenCalledWith(
        'abandoned',
        expect.objectContaining({ current_tier: 'standard' })
      )
      expect(mockCancelSubscription).not.toHaveBeenCalled()
    })

    it('tracks abandoned when the dialog is dismissed by the shell', () => {
      mockSubscription.value = null

      const { unmount } = renderComponent()
      mockTrackCancellation.mockClear()
      unmount()

      expect(mockTrackCancellation).toHaveBeenCalledWith(
        'abandoned',
        expect.objectContaining({ current_tier: 'standard' })
      )
    })
  })

  describe('cancel flow', () => {
    it('shows an error toast and keeps the dialog open when cancellation fails', async () => {
      mockSubscription.value = null
      mockCancelSubscription.mockRejectedValueOnce(
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
      expect(mockCloseDialog).not.toHaveBeenCalled()
    })

    it('closes the dialog and shows a success toast when cancellation succeeds', async () => {
      mockSubscription.value = null
      mockCancelSubscription.mockResolvedValueOnce(undefined)

      renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

      await waitFor(() =>
        expect(mockCloseDialog).toHaveBeenCalledWith({
          key: 'cancel-subscription'
        })
      )
      expect(mockFetchStatus).toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })

    it('does not cancel after the workspace role loses permission', async () => {
      mockSubscription.value = null
      mockShouldUseWorkspaceBilling.value = true
      mockCanManageSubscriptionLifecycle.value = true

      renderComponent()
      mockCanManageSubscriptionLifecycle.value = false
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

      expect(mockCancelSubscription).not.toHaveBeenCalled()
      expect(mockTrackCancellation).not.toHaveBeenCalledWith(
        'confirmed',
        expect.anything()
      )
    })

    it('does not track cancellation failure when status refresh fails after cancellation succeeds', async () => {
      mockSubscription.value = null
      mockCancelSubscription.mockResolvedValueOnce(undefined)
      mockFetchStatus.mockRejectedValueOnce(new Error('Refresh failed'))

      const { unmount } = renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: /^cancel subscription$/i })
      )

      await waitFor(() =>
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'success' })
        )
      )
      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'cancel-subscription'
      })
      expect(
        mockTrackCancellation.mock.calls.some(([stage]) => stage === 'failed')
      ).toBe(false)

      unmount()
      expect(mockTrackCancellation).not.toHaveBeenCalledWith(
        'abandoned',
        expect.anything()
      )
    })
  })

  describe('formattedEndDate fallbacks', () => {
    it('uses the localized fallback when no cancel timestamp is available', () => {
      mockSubscription.value = { endDate: null }
      renderComponent()

      expect(screen.getByText(/end of billing period/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('uses the localized fallback when the timestamp is unparseable', () => {
      mockSubscription.value = { endDate: 'not-a-real-date' }
      renderComponent({ cancelAt: 'also-not-a-date' })

      expect(screen.getByText(/end of billing period/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })
  })

  describe('strict ISO 8601 parsing on Safari/WebView-style runtimes', () => {
    it('renders cancelAt with 4-digit fractional seconds', () => {
      mockSubscription.value = null

      withStrictMillisecondParser(() => {
        renderComponent({ cancelAt: '2026-04-18T10:04:55.6513Z' })
      })

      expect(screen.getByText(/April 18, 2026/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('renders cancelAt with 1-digit fractional seconds', () => {
      mockSubscription.value = null

      withStrictMillisecondParser(() => {
        renderComponent({ cancelAt: '2026-04-18T10:04:55.6Z' })
      })

      expect(screen.getByText(/April 18, 2026/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('renders subscription.endDate with 4-digit fractional seconds when cancelAt is absent', () => {
      mockSubscription.value = { endDate: '2026-04-18T10:04:55.6513Z' }

      withStrictMillisecondParser(() => {
        renderComponent()
      })

      expect(screen.getByText(/April 18, 2026/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('prefers cancelAt prop over subscription.endDate when both are set', () => {
      mockSubscription.value = { endDate: '2030-01-01T00:00:00.000Z' }

      withStrictMillisecondParser(() => {
        renderComponent({ cancelAt: '2026-04-18T10:04:55.6513Z' })
      })

      expect(screen.getByText(/April 18, 2026/)).toBeInTheDocument()
      expect(screen.queryByText(/January 1, 2030/)).not.toBeInTheDocument()
    })
  })
})
