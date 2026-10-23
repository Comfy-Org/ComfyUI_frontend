import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import { createI18n } from 'vue-i18n'

import TopbarSubscribeButton from '@/platform/billing/components/TopbarSubscribeButton.vue'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { BillingStatus } from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'

import CloudRunButtonWrapper from './CloudRunButtonWrapper.vue'

const mockCanRunWorkflows = ref(true)
const mockIsFreeTier = ref(true)
const mockIsInitialized = ref(true)
const mockSubscriptionTier = ref<string | null>(null)
const mockPaymentRecoveryLock = ref<'owner' | 'member' | null>(null)
const showPaymentRecoveryDialog = vi.fn()
const refreshCapabilities = vi.fn(async () => undefined)

vi.mock(import('@/platform/billing/composables/useBillingContext'))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true
}))

vi.mock(
  import('@/platform/billing/subscription/composables/useSubscriptionDialog')
)

vi.mock(import('@/platform/billing/composables/usePaymentRecoveryDialog'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

vi.mock<unknown>(
  import('@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'),
  () => ({
    default: {
      name: 'ComfyQueueButton',
      props: ['paymentRecoveryLock'],
      emits: ['paymentRecoveryClick'],
      template:
        '<div data-testid="queue-group"><div data-testid="batch-count"/><button data-testid="queue-button" :title="paymentRecoveryLock === \'member\' ? \'Ask your workspace owner to restore this subscription\' : undefined" @click="$emit(\'paymentRecoveryClick\')">{{ paymentRecoveryLock === \'owner\' ? \'Update payment to run\' : \'Run\' }}</button><div data-testid="queue-dropdown"/></div>'
    }
  })
)

vi.mock<unknown>(
  import('@/platform/billing/subscription/components/SubscribeToRun.vue'),
  async () => {
    const { registerSubscribeToRunPrompt } =
      await import('@/platform/billing/subscription/composables/useSubscribeCtaPresence')
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

type SubscriptionInfo = NonNullable<
  ReturnType<typeof useBillingContext>['subscription']['value']
>

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

function portalOpenedCallback() {
  const [onPortalOpened] = showPaymentRecoveryDialog.mock.lastCall ?? []
  assert(typeof onPortalOpened === 'function')
  return onPortalOpened
}

function restoreRunOnRefresh() {
  vi.mocked(useBillingContext().fetchStatus).mockImplementationOnce(
    async () => {
      mockPaymentRecoveryLock.value = null
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
    mockPaymentRecoveryLock.value = null
    useBillingCapabilities().canRunWorkflows = computed(() => false)
    useBillingCapabilities().hasResolvedCapabilities = computed(() => true)
    vi.mocked(usePaymentRecoveryDialog).mockReturnValue({
      showPaymentRecoveryDialog,
      updatePayment: vi.fn(),
      isUpdatingPayment: computed(() => false),
      paymentRecoveryLock: computed(() => mockPaymentRecoveryLock.value),
      refreshCapabilities
    })
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
      mockPaymentRecoveryLock.value = 'owner'

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

  it('unlocks Run when resolved capabilities say the actor can run', () => {
    mockCanRunWorkflows.value = false
    mockPaymentRecoveryLock.value = 'owner'
    useBillingCapabilities().canRunWorkflows = computed(() => true)
    renderWrapper()

    expect(screen.getByTestId('queue-button')).toHaveTextContent('Run')
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

  it.for<BillingStatus>(['paid', 'inactive'])(
    'locks Run for payment recovery when payment_recovery_available is true, though billing_status is %s',
    (billingStatus) => {
      useBillingContext().billingStatus = computed(() => billingStatus)
      mockCanRunWorkflows.value = false
      mockPaymentRecoveryLock.value = 'owner'
      renderWrapper()

      expect(screen.getByTestId('queue-button')).toHaveTextContent(
        'Update payment to run'
      )
      expect(
        screen.queryByTestId('subscribe-to-run-button')
      ).not.toBeInTheDocument()
    }
  )

  it.for<BillingStatus>(['paused', 'payment_failed', 'inactive'])(
    'shows the subscribe prompt when payment_recovery_available is false, though billing_status is %s',
    (billingStatus) => {
      useBillingContext().billingStatus = computed(() => billingStatus)
      mockCanRunWorkflows.value = false
      renderWrapper()

      expect(screen.getByTestId('subscribe-to-run-button')).toBeInTheDocument()
      expect(screen.queryByTestId('queue-group')).not.toBeInTheDocument()
    }
  )

  it('locks Run for a member of a past-due workspace and opens the recovery dialog, not the portal', async () => {
    mockCanRunWorkflows.value = false
    mockPaymentRecoveryLock.value = 'member'
    renderWrapper()

    const run = screen.getByRole('button', { name: 'Run' })
    expect(run).toHaveAccessibleDescription(
      'Ask your workspace owner to restore this subscription'
    )
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()

    await userEvent.click(run)

    expect(showPaymentRecoveryDialog).toHaveBeenCalledOnce()
    expect(useBillingContext().manageSubscription).not.toHaveBeenCalled()
  })

  it('refreshes stale billing state on focus and restores Run', async () => {
    mockCanRunWorkflows.value = false
    restoreRunOnRefresh()
    renderWrapper()

    window.dispatchEvent(new Event('focus'))

    await waitFor(() => {
      expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
      expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
      expect(refreshCapabilities).toHaveBeenCalledOnce()
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

  it('preserves queue controls and opens the recovery dialog when payment recovery is available', async () => {
    mockCanRunWorkflows.value = false
    mockPaymentRecoveryLock.value = 'owner'
    renderWrapper()

    expect(screen.getByTestId('batch-count')).toBeInTheDocument()
    expect(screen.getByTestId('queue-dropdown')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment to run' })
    )

    expect(showPaymentRecoveryDialog).toHaveBeenCalledOnce()
  })

  it('does not refresh billing before the recovery portal is opened', async () => {
    mockCanRunWorkflows.value = false
    mockPaymentRecoveryLock.value = 'owner'
    renderWrapper()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment to run' })
    )
    window.dispatchEvent(new Event('focus'))

    expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
    expect(useBillingContext().fetchBalance).not.toHaveBeenCalled()
    expect(refreshCapabilities).not.toHaveBeenCalled()
  })

  it('refreshes billing and capabilities once on focus after returning from the portal', async () => {
    mockCanRunWorkflows.value = false
    mockPaymentRecoveryLock.value = 'owner'
    restoreRunOnRefresh()
    renderWrapper()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment to run' })
    )
    portalOpenedCallback()()

    window.dispatchEvent(new Event('focus'))
    await waitFor(() => {
      expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
      expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
      expect(refreshCapabilities).toHaveBeenCalledOnce()
      expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
    })

    window.dispatchEvent(new Event('focus'))
    expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
    expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
  })
})
