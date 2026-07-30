import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useResubscribe } from './useResubscribe'

const state = vi.hoisted(() => ({
  shouldUseWorkspaceBilling: true,
  canManageSubscriptionLifecycle: true,
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

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: state.toastAdd })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('useResubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.shouldUseWorkspaceBilling = true
    state.canManageSubscriptionLifecycle = true
    state.resubscribe.mockResolvedValue(undefined)
  })

  it('does not resubscribe after the workspace role loses permission', async () => {
    const { handleResubscribe, isResubscribing } = useResubscribe()
    state.canManageSubscriptionLifecycle = false

    await handleResubscribe()

    expect(state.resubscribe).not.toHaveBeenCalled()
    expect(state.trackResubscribeClicked).not.toHaveBeenCalled()
    expect(state.toastAdd).not.toHaveBeenCalled()
    expect(isResubscribing.value).toBe(false)
  })

  it('keeps legacy resubscribe behavior independent of workspace roles', async () => {
    state.shouldUseWorkspaceBilling = false
    state.canManageSubscriptionLifecycle = false
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(state.resubscribe).toHaveBeenCalledOnce()
    expect(state.trackResubscribeClicked).toHaveBeenCalledOnce()
    expect(state.trackBillingEvent).not.toHaveBeenCalled()
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
})
