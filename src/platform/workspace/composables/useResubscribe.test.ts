import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthStoreError } from '@/stores/authStore'

import { useResubscribe } from './useResubscribe'

const state = vi.hoisted(() => ({
  shouldUseWorkspaceBilling: true,
  canManageSubscriptionLifecycle: true,
  canReactivate: true,
  resubscribe: vi.fn(),
  toastAdd: vi.fn(),
  trackResubscribeClicked: vi.fn(),
  trackBillingEvent: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ resubscribe: state.resubscribe })
}))

vi.mock('@/composables/billing/useBillingRouting', () => ({
  useBillingRouting: () => ({
    shouldUseWorkspaceBilling: {
      get value() {
        return state.shouldUseWorkspaceBilling
      }
    }
  })
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    canReactivate: {
      get value() {
        return state.canReactivate
      }
    }
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: {
      get value() {
        return {
          canManageSubscriptionLifecycle: state.canManageSubscriptionLifecycle
        }
      }
    }
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackResubscribeClicked: state.trackResubscribeClicked,
    trackBillingEvent: state.trackBillingEvent
  })
}))

vi.mock('@/stores/authStore', () => ({
  AuthStoreError: class AuthStoreError extends Error {
    readonly status: number | undefined
    constructor(message: string, status?: number) {
      super(message)
      this.name = 'AuthStoreError'
      this.status = status
    }
  }
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: state.toastAdd })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('useResubscribe', () => {
  beforeEach(() => {
    state.shouldUseWorkspaceBilling = true
    state.canManageSubscriptionLifecycle = true
    state.canReactivate = true
    state.resubscribe.mockResolvedValue(undefined)
  })

  it('does not resubscribe after the workspace role loses permission', async () => {
    const { handleResubscribe, isResubscribing } = useResubscribe()
    state.canManageSubscriptionLifecycle = false
    state.canReactivate = false

    await handleResubscribe()

    expect(state.resubscribe).not.toHaveBeenCalled()
    expect(state.trackResubscribeClicked).not.toHaveBeenCalled()
    expect(state.toastAdd).not.toHaveBeenCalled()
    expect(isResubscribing.value).toBe(false)
  })

  it('does not resubscribe when the server denies reactivation to a client-side owner', async () => {
    state.canManageSubscriptionLifecycle = true
    state.canReactivate = false
    const { handleResubscribe, isResubscribing } = useResubscribe()

    await handleResubscribe()

    expect(state.resubscribe).not.toHaveBeenCalled()
    expect(state.trackResubscribeClicked).not.toHaveBeenCalled()
    expect(state.toastAdd).not.toHaveBeenCalled()
    expect(isResubscribing.value).toBe(false)
  })

  it('fires a started event before resubscribe resolves', async () => {
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(state.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'resubscribe',
      stage: 'started',
      outcome: 'pending',
      source: 'settings_billing_panel'
    })
  })

  it('does not report checkout launch as terminal legacy success', async () => {
    state.shouldUseWorkspaceBilling = false
    state.canManageSubscriptionLifecycle = false
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(state.resubscribe).toHaveBeenCalledOnce()
    expect(state.trackResubscribeClicked).toHaveBeenCalledOnce()
    expect(state.trackBillingEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'succeeded' })
    )
    expect(state.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'resubscribe',
      stage: 'started',
      outcome: 'pending',
      source: 'settings_billing_panel'
    })
    // Exactly one started event on the legacy success rail: the pre-call start,
    // with no duplicate post-await started/pending emitted after resubscribe() resolves.
    expect(state.trackBillingEvent).toHaveBeenCalledTimes(1)
    expect(state.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('shows an error and resets loading when resubscription fails', async () => {
    state.resubscribe.mockRejectedValueOnce(
      new Error('Resubscribe failed for person@example.com')
    )
    const { handleResubscribe, isResubscribing } = useResubscribe()

    await handleResubscribe()

    expect(state.resubscribe).toHaveBeenCalledOnce()
    expect(state.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Resubscribe failed for person@example.com'
      })
    )
    expect(state.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'resubscribe',
      stage: 'failed',
      outcome: 'failure',
      source: 'settings_billing_panel',
      failure_category: 'unknown'
    })
    expect(isResubscribing.value).toBe(false)
  })

  it('fires resubscribe failure telemetry on the legacy rail too, categorizing the error', async () => {
    state.shouldUseWorkspaceBilling = false
    const authStoreError = new AuthStoreError(
      'checkout initiation rejected',
      500
    )
    state.resubscribe.mockRejectedValueOnce(authStoreError)
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(state.trackBillingEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'succeeded' })
    )
    expect(state.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'resubscribe',
      stage: 'failed',
      outcome: 'failure',
      source: 'settings_billing_panel',
      failure_category: 'api_rejected'
    })
  })

  it('categorizes an AuthStoreError with no status as a network failure, not an api rejection', async () => {
    state.shouldUseWorkspaceBilling = false
    const authStoreError = new AuthStoreError('offline')
    state.resubscribe.mockRejectedValueOnce(authStoreError)
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(state.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'resubscribe',
      stage: 'failed',
      outcome: 'failure',
      source: 'settings_billing_panel',
      failure_category: 'network'
    })
  })

  it('emits started before the awaited resubscribe call resolves', async () => {
    const callOrder: string[] = []
    state.resubscribe.mockImplementation(async () => {
      callOrder.push('resubscribe')
    })
    state.trackBillingEvent.mockImplementation((event: { stage: string }) => {
      callOrder.push(`trackBillingEvent:${event.stage}`)
    })
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(callOrder.indexOf('trackBillingEvent:started')).toBeLessThan(
      callOrder.indexOf('resubscribe')
    )
  })
})
