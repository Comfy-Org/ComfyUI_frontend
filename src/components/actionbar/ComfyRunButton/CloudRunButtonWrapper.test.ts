import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import CloudRunButtonWrapper from './CloudRunButtonWrapper.vue'

const mockCanRunWorkflows = ref(true)
const mockIsInitialized = ref(true)
const mockBillingStatus = ref<string | null>('paid')
const state = vi.hoisted(() => ({
  v1PaymentRecovery: true,
  canManageSubscription: true,
  manageSubscription: vi.fn(),
  fetchStatus: vi.fn(),
  fetchBalance: vi.fn(),
  toastErrorHandler: vi.fn(),
  showLayoutDialog: vi.fn(),
  closeDialog: vi.fn(),
  updateDialog: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', async () => {
  const { computed } = await import('vue')
  return {
    useBillingContext: () => ({
      canRunWorkflows: mockCanRunWorkflows,
      showsSubscribeToRunPrompt: computed(
        () => mockIsInitialized.value && !mockCanRunWorkflows.value
      ),
      billingStatus: mockBillingStatus,
      manageSubscription: state.manageSubscription,
      fetchStatus: state.fetchStatus,
      fetchBalance: state.fetchBalance
    })
  }
})

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get v1PaymentRecovery() {
        return state.v1PaymentRecovery
      }
    }
  })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({ toastErrorHandler: state.toastErrorHandler })
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
  useDialogStore: () => ({
    closeDialog: state.closeDialog,
    updateDialog: state.updateDialog
  })
}))

vi.mock('@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue', () => ({
  default: {
    name: 'ComfyQueueButton',
    props: ['paymentRecoveryLock'],
    emits: ['paymentRecoveryClick'],
    template:
      '<div data-testid="queue-group"><div data-testid="batch-count"/><button data-testid="queue-button" @click="$emit(\'paymentRecoveryClick\')">{{ paymentRecoveryLock === \'owner\' ? \'Update payment to run\' : \'Run\' }}</button><div data-testid="queue-dropdown"/></div>'
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
    mockIsInitialized.value = true
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
    const dialogOptions = state.showLayoutDialog.mock.calls[0][0]
    expect(dialogOptions.props.canManage).toBe(true)

    await dialogOptions.props.onUpdatePayment()
    expect(state.closeDialog).toHaveBeenCalledWith({
      key: 'subscription-paused'
    })
    expect(state.manageSubscription).toHaveBeenCalledOnce()
  })

  it('keeps recovery open and surfaces portal failures', async () => {
    const error = new Error('Portal unavailable')
    state.manageSubscription.mockRejectedValueOnce(error)
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
    renderWrapper()

    await userEvent.click(screen.getByTestId('queue-button'))
    const dialogOptions = state.showLayoutDialog.mock.calls[0][0]
    await dialogOptions.props.onUpdatePayment()

    expect(state.toastErrorHandler).toHaveBeenCalledWith(error)
    expect(state.closeDialog).not.toHaveBeenCalled()
  })

  it('refreshes billing once on focus after returning from the portal', async () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
    state.fetchStatus.mockImplementationOnce(() => {
      mockBillingStatus.value = 'paid'
      mockCanRunWorkflows.value = true
    })
    renderWrapper()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment to run' })
    )
    const dialog = state.showLayoutDialog.mock.calls[0][0]
    await dialog.props.onUpdatePayment()

    window.dispatchEvent(new Event('focus'))
    await waitFor(() => {
      expect(state.fetchStatus).toHaveBeenCalledOnce()
      expect(state.fetchBalance).toHaveBeenCalledOnce()
      expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
    })

    window.dispatchEvent(new Event('focus'))
    expect(state.fetchStatus).toHaveBeenCalledOnce()
    expect(state.fetchBalance).toHaveBeenCalledOnce()
  })

  it('reuses a pending portal request across rapid clicks and reopen', async () => {
    let resolvePortal!: () => void
    state.manageSubscription.mockImplementationOnce(
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
    const firstDialog = state.showLayoutDialog.mock.calls[0][0]
    const firstRequest = firstDialog.props.onUpdatePayment()
    const repeatedRequest = firstDialog.props.onUpdatePayment()
    expect(state.manageSubscription).toHaveBeenCalledOnce()

    firstDialog.props.onClose()
    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment to run' })
    )
    const reopenedDialog = state.showLayoutDialog.mock.calls.at(-1)?.[0]
    expect(reopenedDialog.props.isUpdatingPayment).toBe(true)
    expect(reopenedDialog.props.onUpdatePayment()).toBe(firstRequest)
    expect(repeatedRequest).toBe(firstRequest)
    expect(state.manageSubscription).toHaveBeenCalledOnce()

    resolvePortal()
    await firstRequest
    expect(state.updateDialog).toHaveBeenLastCalledWith({
      key: 'subscription-paused',
      contentProps: { isUpdatingPayment: false }
    })
  })

  it('does not update a replacement dialog after unmount', async () => {
    let resolvePortal!: () => void
    state.manageSubscription.mockImplementationOnce(
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
    const dialog = state.showLayoutDialog.mock.calls[0][0]
    const portalRequest = dialog.props.onUpdatePayment()
    unmount()

    resolvePortal()
    await portalRequest
    expect(state.closeDialog).not.toHaveBeenCalled()
    expect(state.updateDialog).toHaveBeenCalledTimes(1)
    expect(state.updateDialog).toHaveBeenCalledWith({
      key: 'subscription-paused',
      contentProps: { isUpdatingPayment: true }
    })
  })

  it('opens member-safe recovery copy without a payment action', async () => {
    mockCanRunWorkflows.value = false
    mockBillingStatus.value = 'paused'
    state.canManageSubscription = false
    renderWrapper()

    expect(screen.getByTestId('queue-button')).toHaveTextContent('Run')
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
