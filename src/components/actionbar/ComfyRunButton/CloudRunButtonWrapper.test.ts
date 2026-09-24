import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import { createI18n } from 'vue-i18n'

import TopbarSubscribeButton from '@/components/topbar/TopbarSubscribeButton.vue'
import type { SubscriptionInfo } from '@/composables/billing/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import type { BillingStatus } from '@/platform/workspace/api/workspaceApi'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

import CloudRunButtonWrapper from './CloudRunButtonWrapper.vue'

const mockCanRunWorkflows = ref(true)
const mockIsFreeTier = ref(true)
const mockIsInitialized = ref(true)
const mockBillingStatus = ref<BillingStatus | null>('paid')
const mockSubscriptionTier = ref<string | null>(null)

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true
}))

vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/composables/useErrorHandling'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

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

function setCanManageSubscription(value: boolean) {
  const permissions = useWorkspaceUI().permissions.value
  vi.mocked(useWorkspaceUI()).permissions = computed(() => ({
    ...permissions,
    canManageSubscription: value
  }))
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
    hasFunds: true
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

describe('CloudRunButtonWrapper', () => {
  beforeEach(() => {
    const billing = vi.mocked(useBillingContext())
    billing.canRunWorkflows = computed(() => mockCanRunWorkflows.value)
    billing.showsSubscribeToRunPrompt = computed(
      () => mockIsInitialized.value && !mockCanRunWorkflows.value
    )
    billing.billingStatus = computed(() => mockBillingStatus.value)
    billing.isFreeTier = computed(() => mockIsFreeTier.value)
    billing.subscription = computed(() =>
      subscription(mockSubscriptionTier.value)
    )
    vi.mocked(useBillingContext).mockReturnValue(billing)
    setCanManageSubscription(true)
    mockCanRunWorkflows.value = true
    mockIsInitialized.value = true
    mockBillingStatus.value = 'paid'
    mockSubscriptionTier.value = null
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = true
    mockIsFreeTier.value = true
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
      mockBillingStatus.value = 'paused'

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

  it('refreshes stale billing state on focus and restores Run', async () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'inactive'
    vi.mocked(useBillingContext().fetchStatus).mockImplementationOnce(
      async () => {
        mockBillingStatus.value = 'paid'
        mockCanRunWorkflows.value = true
      }
    )
    renderWrapper()

    window.dispatchEvent(new Event('focus'))

    await waitFor(() => {
      expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
      expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
      expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
    })
  })

  it('refreshes stale billing state when the app becomes visible', async () => {
    const visibilityState = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
    try {
      mockCanRunWorkflows.value = false
      mockBillingStatus.value = 'inactive'
      vi.mocked(useBillingContext().fetchStatus).mockImplementationOnce(
        async () => {
          mockBillingStatus.value = 'paid'
          mockCanRunWorkflows.value = true
        }
      )
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
      mockBillingStatus.value = 'inactive'
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
      mockBillingStatus.value = 'inactive'
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
    mockBillingStatus.value = 'inactive'
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

  it('preserves queue controls and opens the owner recovery flow when paused', async () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
    renderWrapper()

    expect(screen.getByTestId('batch-count')).toBeInTheDocument()
    expect(screen.getByTestId('queue-dropdown')).toBeInTheDocument()
    expect(screen.getByTestId('queue-button')).toHaveTextContent(
      'Update payment to run'
    )
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment to run' })
    )
    const dialogProps = getPaymentRecoveryDialog()
    expect(dialogProps.canManage).toBe(true)
    expect(dialogProps.status).toBe('paused')

    await dialogProps.onUpdatePayment()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'subscription-paused'
    })
    expect(useBillingContext().manageSubscription).toHaveBeenCalledOnce()
  })

  it('does not refresh paused billing before the recovery portal is opened', () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
    renderWrapper()

    window.dispatchEvent(new Event('focus'))

    expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
    expect(useBillingContext().fetchBalance).not.toHaveBeenCalled()
  })

  it('keeps recovery open and surfaces portal failures', async () => {
    const error = new Error('Portal unavailable')
    vi.mocked(useBillingContext().manageSubscription).mockRejectedValueOnce(
      error
    )
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
    renderWrapper()

    await userEvent.click(screen.getByTestId('queue-button'))
    const dialogProps = getPaymentRecoveryDialog()
    await dialogProps.onUpdatePayment()

    expect(useErrorHandling().toastErrorHandler).toHaveBeenCalledWith(error)
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
  })

  it('refreshes billing once on focus after returning from the portal', async () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
    vi.mocked(useBillingContext().fetchStatus).mockImplementationOnce(
      async () => {
        mockBillingStatus.value = 'paid'
        mockCanRunWorkflows.value = true
      }
    )
    renderWrapper()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment to run' })
    )
    const dialogProps = getPaymentRecoveryDialog()
    await dialogProps.onUpdatePayment()

    window.dispatchEvent(new Event('focus'))
    await waitFor(() => {
      expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
      expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
      expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
    })

    window.dispatchEvent(new Event('focus'))
    expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
    expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
  })

  it('reuses a pending portal request across rapid clicks and reopen', async () => {
    let resolvePortal!: () => void
    vi.mocked(useBillingContext().manageSubscription).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolvePortal = resolve
        })
    )
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
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
    expect(reopenedDialogProps.onUpdatePayment()).toBe(firstRequest)
    expect(repeatedRequest).toBe(firstRequest)
    expect(useBillingContext().manageSubscription).toHaveBeenCalledOnce()

    resolvePortal()
    await firstRequest
    expect(useDialogStore().updateDialog).toHaveBeenLastCalledWith({
      key: 'subscription-paused',
      contentProps: { isUpdatingPayment: false }
    })
  })

  it('does not update a replacement dialog after unmount', async () => {
    let resolvePortal!: () => void
    vi.mocked(useBillingContext().manageSubscription).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolvePortal = resolve
        })
    )
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
    const { unmount } = renderWrapper()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment to run' })
    )
    const dialogProps = getPaymentRecoveryDialog()
    const portalRequest = dialogProps.onUpdatePayment()
    unmount()

    resolvePortal()
    await portalRequest
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    expect(useDialogStore().updateDialog).toHaveBeenCalledTimes(1)
    expect(useDialogStore().updateDialog).toHaveBeenCalledWith({
      key: 'subscription-paused',
      contentProps: { isUpdatingPayment: true }
    })
  })

  it('opens member-safe recovery copy without a payment action', async () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
    setCanManageSubscription(false)
    renderWrapper()

    expect(screen.getByTestId('queue-button')).toHaveTextContent('Run')
    await userEvent.click(screen.getByTestId('queue-button'))

    const dialogProps = getPaymentRecoveryDialog()
    expect(dialogProps.canManage).toBe(false)
    expect(dialogProps.status).toBe('paused')
    dialogProps.onClose()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'subscription-paused'
    })
    expect(useBillingContext().manageSubscription).not.toHaveBeenCalled()
  })

  it('opens payment recovery for a payment-failed owner', async () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'payment_failed'
    renderWrapper()

    expect(screen.getByTestId('queue-button')).toHaveTextContent(
      'Update payment to run'
    )
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('queue-button'))

    const dialogProps = getPaymentRecoveryDialog()
    expect(dialogProps.canManage).toBe(true)
    expect(dialogProps.status).toBe('payment_failed')
  })

  it('keeps Run locked with owner guidance for a payment-failed member', async () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'payment_failed'
    setCanManageSubscription(false)
    renderWrapper()

    expect(screen.getByTestId('queue-button')).toHaveTextContent('Run')
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('queue-button'))

    const dialogProps = getPaymentRecoveryDialog()
    expect(dialogProps.canManage).toBe(false)
    expect(dialogProps.status).toBe('payment_failed')
  })

  it('does not fall back to Subscribe to Run for payment failure when recovery flag is disabled', () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'payment_failed'
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = false
    renderWrapper()

    expect(screen.getByTestId('queue-button')).toHaveTextContent(
      'Update payment to run'
    )
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()
  })

  it('keeps generic inactive behavior when payment recovery is disabled', () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = false
    renderWrapper()

    expect(screen.getByTestId('subscribe-to-run-button')).toBeInTheDocument()
    expect(screen.queryByTestId('queue-group')).not.toBeInTheDocument()
  })

  it('keeps generic inactive behavior for non-paused statuses', () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'inactive'
    renderWrapper()

    expect(screen.getByTestId('subscribe-to-run-button')).toBeInTheDocument()
    expect(screen.queryByTestId('queue-group')).not.toBeInTheDocument()
  })
})
