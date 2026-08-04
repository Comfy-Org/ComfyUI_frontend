import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import CloudRunButtonWrapper from './CloudRunButtonWrapper.vue'

const mockCanRunWorkflows = ref(true)
const mockBillingStatus = ref<string | null>('paid')
const state = vi.hoisted(() => ({
  v1PaymentRecovery: true,
  canManageSubscription: true,
  manageSubscription: vi.fn(),
  showLayoutDialog: vi.fn(),
  closeDialog: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canRunWorkflows: mockCanRunWorkflows,
    billingStatus: mockBillingStatus,
    manageSubscription: state.manageSubscription
  })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get v1PaymentRecovery() {
        return state.v1PaymentRecovery
      }
    }
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', async () => {
  const { computed } = await import('vue')
  return {
    useWorkspaceUI: () => ({
      permissions: computed(() => ({
        canManageSubscription: state.canManageSubscription
      }))
    })
  }
})

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showLayoutDialog: state.showLayoutDialog })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: state.closeDialog })
}))

vi.mock('@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue', () => ({
  default: {
    name: 'ComfyQueueButton',
    props: ['paymentRecoveryLock'],
    emits: ['paymentRecoveryClick'],
    template:
      '<div data-testid="queue-group"><div data-testid="batch-count"/><button data-testid="queue-button" @click="$emit(\'paymentRecoveryClick\')">{{ paymentRecoveryLock ?? \'queue\' }}</button><div data-testid="queue-dropdown"/></div>'
  }
}))

vi.mock('@/platform/cloud/subscription/components/SubscribeToRun.vue', () => ({
  default: {
    name: 'SubscribeToRun',
    template: '<div data-testid="subscribe-to-run-button" />'
  }
}))

function renderWrapper() {
  return render(CloudRunButtonWrapper)
}

describe('CloudRunButtonWrapper', () => {
  beforeEach(() => {
    mockCanRunWorkflows.value = true
    mockBillingStatus.value = 'paid'
    state.v1PaymentRecovery = true
    state.canManageSubscription = true
    vi.clearAllMocks()
  })

  it('renders the runnable queue button when the subscription is active', () => {
    renderWrapper()

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
    expect(screen.getByTestId('queue-button')).toHaveTextContent('owner')
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('queue-button'))
    const dialogOptions = state.showLayoutDialog.mock.calls[0][0]
    expect(dialogOptions.props.canManage).toBe(true)

    dialogOptions.props.onUpdatePayment()
    expect(state.closeDialog).toHaveBeenCalledWith({
      key: 'subscription-paused'
    })
    expect(state.manageSubscription).toHaveBeenCalledOnce()
  })

  it('opens member-safe recovery copy without a payment action', async () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
    state.canManageSubscription = false
    renderWrapper()

    expect(screen.getByTestId('queue-button')).toHaveTextContent('member')
    await userEvent.click(screen.getByTestId('queue-button'))

    const dialogOptions = state.showLayoutDialog.mock.calls[0][0]
    expect(dialogOptions.props.canManage).toBe(false)
    dialogOptions.props.onClose()
    expect(state.closeDialog).toHaveBeenCalledWith({
      key: 'subscription-paused'
    })
    expect(state.manageSubscription).not.toHaveBeenCalled()
  })

  it('keeps generic inactive behavior when payment recovery is disabled', () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
    state.v1PaymentRecovery = false
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
