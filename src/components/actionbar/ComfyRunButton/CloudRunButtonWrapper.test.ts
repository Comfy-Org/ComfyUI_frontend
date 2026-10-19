import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import { createI18n } from 'vue-i18n'

import TopbarSubscribeButton from '@/components/topbar/TopbarSubscribeButton.vue'
import type {
  BillingPortalOutcome,
  SubscriptionInfo
} from '@/composables/billing/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { BillingStatus } from '@/platform/workspace/api/workspaceApi'
import { paymentRecoveryAvailableFact } from '@/platform/workspace/composables/__mocks__/useBillingCapabilities'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

import CloudRunButtonWrapper from './CloudRunButtonWrapper.vue'

const mockCanRunWorkflows = ref(true)
const mockIsFreeTier = ref(true)
const mockIsInitialized = ref(true)
const mockSubscriptionTier = ref<string | null>(null)
const mockPaymentRecoveryAvailable = ref(false)

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true
}))

vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/composables/useErrorHandling'))
vi.mock(import('@/platform/telemetry/reportError'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/services/dialogService'))

vi.mock<unknown>(
  import('@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'),
  () => ({
    default: {
      name: 'ComfyQueueButton',
      props: ['paymentRecoveryLock'],
      emits: ['paymentRecoveryClick'],
      template:
        '<div data-testid="queue-group"><div data-testid="batch-count"/><button data-testid="queue-button" @click="$emit(\'paymentRecoveryClick\')">{{ paymentRecoveryLock === \'owner\' ? \'Update payment to run\' : \'Run\' }}</button><div data-testid="queue-dropdown"/></div>'
    }
  })
)

vi.mock<unknown>(
  import('@/platform/cloud/subscription/components/SubscribeToRun.vue'),
  async () => {
    const { registerSubscribeToRunPrompt } =
      await import('@/platform/cloud/subscription/composables/useSubscribeCtaPresence')
    return {
      default: {
        name: 'SubscribeToRun',
        setup: () => registerSubscribeToRunPrompt(),
        template: '<div data-testid="subscribe-to-run-button" />'
      }
    }
  }
)

function renderWrapper() {
  return render(CloudRunButtonWrapper)
}

function subscription(tier: string | null): SubscriptionInfo | null {
  if (!tier) return null
  const result: SubscriptionInfo = {
    isActive: true,
    tier: null,
    duration: null,
    planSlug: null,
    scheduledChange: null,
    renewalDate: null,
    endDate: null,
    isCancelled: false,
    hasFunds: true,
    agentHasFunds: true
  }
  Object.defineProperty(result, 'tier', { value: tier })
  return result
}

function getPaymentRecoveryDialog(index = 0) {
  const call = vi
    .mocked(useDialogService().showLayoutDialog)
    .mock.calls.at(index)
  assert(call)
  const { props } = call[0]
  assert('canManage' in props)
  assert('status' in props)
  assert('isUpdatingPayment' in props)
  assert('onClose' in props)
  assert('onUpdatePayment' in props)
  const { canManage, status, isUpdatingPayment, onClose, onUpdatePayment } =
    props
  assert(typeof canManage === 'boolean')
  assert(typeof status === 'string')
  assert(typeof isUpdatingPayment === 'boolean')
  assert(typeof onClose === 'function')
  assert(typeof onUpdatePayment === 'function')
  return { canManage, status, isUpdatingPayment, onClose, onUpdatePayment }
}

function restoreRunOnRefresh() {
  vi.mocked(useBillingContext().fetchStatus).mockImplementationOnce(
    async () => {
      mockPaymentRecoveryAvailable.value = false
      mockCanRunWorkflows.value = true
    }
  )
}

describe('CloudRunButtonWrapper', () => {
  beforeEach(() => {
    const billing = vi.mocked(useBillingContext())
    billing.canRunWorkflows = computed(() => mockCanRunWorkflows.value)
    billing.showsSubscribeToRunPrompt = computed(
      () => mockIsInitialized.value && !mockCanRunWorkflows.value
    )
    billing.isFreeTier = computed(() => mockIsFreeTier.value)
    billing.subscription = computed(() =>
      subscription(mockSubscriptionTier.value)
    )
    vi.mocked(useBillingContext).mockReturnValue(billing)
    mockCanRunWorkflows.value = true
    mockIsInitialized.value = true
    mockSubscriptionTier.value = null
    mockIsFreeTier.value = true
    mockPaymentRecoveryAvailable.value = false
    useBillingCapabilities().paymentRecoveryAvailable =
      paymentRecoveryAvailableFact(mockPaymentRecoveryAvailable)
  })

  describe('one subscribe CTA at a time', () => {
    const CtaSurface = {
      components: { CloudRunButtonWrapper, TopbarSubscribeButton },
      template: '<div><TopbarSubscribeButton /><CloudRunButtonWrapper /></div>'
    }

    function renderCtaSurface() {
      const i18n = createI18n({
        legacy: false,
        locale: 'en',
        messages: { en: enMessages }
      })
      return render(CtaSurface, { global: { plugins: [i18n] } })
    }

    it('keeps the topbar CTA on a sales-managed plan, where the prompt never mounts', () => {
      mockCanRunWorkflows.value = false
      mockSubscriptionTier.value = 'ENTERPRISE'

      renderCtaSurface()

      expect(
        screen.queryByTestId('subscribe-to-run-button')
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('topbar-subscribe-button')).toBeInTheDocument()
    })

    it('keeps the topbar CTA under payment recovery, where the prompt never mounts', () => {
      mockCanRunWorkflows.value = false
      mockPaymentRecoveryAvailable.value = true

      renderCtaSurface()

      expect(
        screen.queryByTestId('subscribe-to-run-button')
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('topbar-subscribe-button')).toBeInTheDocument()
    })

    it('yields the topbar CTA only while the prompt is actually mounted', async () => {
      mockCanRunWorkflows.value = false

      renderCtaSurface()
      await nextTick()

      expect(screen.getByTestId('subscribe-to-run-button')).toBeInTheDocument()
      expect(
        screen.queryByTestId('topbar-subscribe-button')
      ).not.toBeInTheDocument()
    })
  })

  it('renders the runnable queue button when the subscription is active', () => {
    renderWrapper()

    expect(screen.getByTestId('queue-button')).toBeInTheDocument()
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()
  })

  it('keeps the run button while billing status is still resolving', () => {
    mockCanRunWorkflows.value = false
    mockIsInitialized.value = false

    render(CloudRunButtonWrapper)

    expect(screen.getByTestId('queue-button')).toBeInTheDocument()
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()
  })

  it('locks the run button when the subscription is inactive', () => {
    mockCanRunWorkflows.value = false
    renderWrapper()

    expect(screen.getByTestId('subscribe-to-run-button')).toBeInTheDocument()
    expect(screen.queryByTestId('queue-button')).not.toBeInTheDocument()
  })

  it('keeps the run button without a subscribe upsell on a sales-managed plan', () => {
    mockCanRunWorkflows.value = false
    mockSubscriptionTier.value = 'ENTERPRISE'
    renderWrapper()

    expect(screen.getByTestId('queue-button')).toBeInTheDocument()
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()
  })

  it('keeps the run button without a subscribe upsell on an unrecognized tier', () => {
    mockCanRunWorkflows.value = false
    mockSubscriptionTier.value = 'GALACTIC'
    renderWrapper()

    expect(screen.getByTestId('queue-button')).toBeInTheDocument()
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()
  })

  it.for<{
    billingStatus: BillingStatus
    available: boolean
    locked: boolean
  }>([
    { billingStatus: 'paid', available: true, locked: true },
    { billingStatus: 'paused', available: false, locked: false },
    { billingStatus: 'payment_failed', available: false, locked: false },
    { billingStatus: 'inactive', available: false, locked: false }
  ])(
    'locks Run for payment recovery only when payment_recovery_available is $available, whatever billing_status $billingStatus says',
    ({ billingStatus, available, locked }) => {
      useBillingContext().billingStatus = computed(() => billingStatus)
      mockCanRunWorkflows.value = false
      mockPaymentRecoveryAvailable.value = available
      renderWrapper()

      if (locked) {
        expect(screen.getByTestId('queue-button')).toHaveTextContent(
          'Update payment to run'
        )
        expect(
          screen.queryByTestId('subscribe-to-run-button')
        ).not.toBeInTheDocument()
      } else {
        expect(
          screen.getByTestId('subscribe-to-run-button')
        ).toBeInTheDocument()
        expect(screen.queryByTestId('queue-group')).not.toBeInTheDocument()
      }
    }
  )

  it('refreshes stale billing state on focus and restores Run', async () => {
    mockCanRunWorkflows.value = false
    restoreRunOnRefresh()
    renderWrapper()

    window.dispatchEvent(new Event('focus'))

    await waitFor(() => {
      expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
      expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
      expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
      expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
    })
  })

  it('refreshes stale billing state when the app becomes visible', async () => {
    const visibilityState = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
    try {
      mockCanRunWorkflows.value = false
      restoreRunOnRefresh()
      renderWrapper()

      document.dispatchEvent(new Event('visibilitychange'))

      await waitFor(() => {
        expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
        expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
        expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
      })
    } finally {
      visibilityState.mockRestore()
    }
  })

  it('deduplicates simultaneous focus and visibility refreshes', async () => {
    let resolveRefresh!: () => void
    const refresh = new Promise<void>((resolve) => {
      resolveRefresh = resolve
    })
    const visibilityState = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
    try {
      mockCanRunWorkflows.value = false
      vi.mocked(useBillingContext().fetchStatus).mockReturnValueOnce(refresh)
      vi.mocked(useBillingContext().fetchBalance).mockReturnValueOnce(refresh)
      renderWrapper()

      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))

      expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
      expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()

      resolveRefresh()
      await refresh
    } finally {
      visibilityState.mockRestore()
    }
  })

  it('does not refresh billing while Run is already available', () => {
    renderWrapper()

    window.dispatchEvent(new Event('focus'))

    expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
    expect(useBillingContext().fetchBalance).not.toHaveBeenCalled()
  })

  it('ignores visibility changes while the app remains hidden', () => {
    const visibilityState = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    try {
      mockCanRunWorkflows.value = false
      renderWrapper()

      document.dispatchEvent(new Event('visibilitychange'))

      expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
      expect(useBillingContext().fetchBalance).not.toHaveBeenCalled()
    } finally {
      visibilityState.mockRestore()
    }
  })

  it('retries a failed stale billing refresh on the next focus', async () => {
    mockCanRunWorkflows.value = false
    vi.mocked(useBillingContext().fetchStatus).mockRejectedValueOnce(
      new Error('Status unavailable')
    )
    vi.mocked(useBillingContext().fetchBalance).mockRejectedValueOnce(
      new Error('Balance unavailable')
    )
    renderWrapper()

    window.dispatchEvent(new Event('focus'))
    await waitFor(() =>
      expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
    )
    await new Promise((resolve) => setTimeout(resolve))

    window.dispatchEvent(new Event('focus'))

    await waitFor(() => {
      expect(useBillingContext().fetchStatus).toHaveBeenCalledTimes(2)
      expect(useBillingContext().fetchBalance).toHaveBeenCalledTimes(2)
    })
  })

  it('unlocks the run button once the subscription becomes active again', async () => {
    mockCanRunWorkflows.value = false
    renderWrapper()

    expect(screen.getByTestId('subscribe-to-run-button')).toBeInTheDocument()

    mockCanRunWorkflows.value = true
    await nextTick()

    expect(screen.getByTestId('queue-button')).toBeInTheDocument()
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()
  })

  it('preserves queue controls and opens the recovery flow when payment recovery is available', async () => {
    mockCanRunWorkflows.value = false
    mockPaymentRecoveryAvailable.value = true
    renderWrapper()

    expect(screen.getByTestId('batch-count')).toBeInTheDocument()
    expect(screen.getByTestId('queue-dropdown')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment to run' })
    )
    const dialogProps = getPaymentRecoveryDialog()
    expect(dialogProps.canManage).toBe(true)
    expect(dialogProps.status).toBe('payment_failed')

    await dialogProps.onUpdatePayment()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'subscription-paused'
    })
    expect(useBillingContext().manageSubscription).toHaveBeenCalledOnce()
  })

  it('does not refresh billing before the recovery portal is opened', () => {
    mockCanRunWorkflows.value = false
    mockPaymentRecoveryAvailable.value = true
    renderWrapper()

    window.dispatchEvent(new Event('focus'))

    expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
    expect(useBillingContext().fetchBalance).not.toHaveBeenCalled()
    expect(useBillingCapabilities().refresh).not.toHaveBeenCalled()
  })

  it('keeps recovery open and surfaces portal failures', async () => {
    const error = new Error('Portal unavailable')
    vi.mocked(useBillingContext().manageSubscription).mockRejectedValueOnce(
      error
    )
    mockCanRunWorkflows.value = false
    mockPaymentRecoveryAvailable.value = true
    renderWrapper()

    await userEvent.click(screen.getByTestId('queue-button'))
    await getPaymentRecoveryDialog().onUpdatePayment()

    expect(useErrorHandling().toastErrorHandler).toHaveBeenCalledWith(error)
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('focus'))
    expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
  })

  it('keeps recovery open when the billing context reports the portal did not open', async () => {
    vi.mocked(useBillingContext().manageSubscription).mockResolvedValueOnce({
      ok: false,
      reason: 'blocked'
    })
    mockCanRunWorkflows.value = false
    mockPaymentRecoveryAvailable.value = true
    renderWrapper()

    await userEvent.click(screen.getByTestId('queue-button'))
    await getPaymentRecoveryDialog().onUpdatePayment()

    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('focus'))
    expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
  })

  it('refreshes billing and capabilities once on focus after returning from the portal', async () => {
    mockCanRunWorkflows.value = false
    mockPaymentRecoveryAvailable.value = true
    restoreRunOnRefresh()
    renderWrapper()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment to run' })
    )
    await getPaymentRecoveryDialog().onUpdatePayment()

    window.dispatchEvent(new Event('focus'))
    await waitFor(() => {
      expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
      expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
      expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
      expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
    })

    window.dispatchEvent(new Event('focus'))
    expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
    expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
  })

  it('reuses a pending portal request across rapid clicks and reopen', async () => {
    let resolvePortal!: (outcome: BillingPortalOutcome) => void
    vi.mocked(useBillingContext().manageSubscription).mockImplementationOnce(
      () =>
        new Promise<BillingPortalOutcome>((resolve) => {
          resolvePortal = resolve
        })
    )
    mockCanRunWorkflows.value = false
    mockPaymentRecoveryAvailable.value = true
    renderWrapper()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment to run' })
    )
    const firstDialogProps = getPaymentRecoveryDialog()
    const firstRequest = firstDialogProps.onUpdatePayment()
    const repeatedRequest = firstDialogProps.onUpdatePayment()
    expect(useBillingContext().manageSubscription).toHaveBeenCalledOnce()

    firstDialogProps.onClose()
    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment to run' })
    )
    const reopenedDialogProps = getPaymentRecoveryDialog(-1)
    expect(reopenedDialogProps.isUpdatingPayment).toBe(true)
    const reopenedRequest = reopenedDialogProps.onUpdatePayment()
    expect(useBillingContext().manageSubscription).toHaveBeenCalledOnce()

    resolvePortal({ ok: true })
    await Promise.all([firstRequest, repeatedRequest, reopenedRequest])
    expect(useDialogStore().updateDialog).toHaveBeenLastCalledWith({
      key: 'subscription-paused',
      contentProps: { isUpdatingPayment: false }
    })
  })
})
