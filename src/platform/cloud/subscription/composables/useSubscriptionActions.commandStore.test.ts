import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'
import { useCommandStore } from '@/stores/commandStore'

// Separate from the sibling suite because that one mocks commandStore, and the
// bug this guards against was the mock disagreeing with the real execute():
// it resolves after handling a registered command's failure rather than
// rethrowing, so a mocked rejection proves nothing about production.
const { mockCaptureException } = vi.hoisted(() => ({
  mockCaptureException: vi.fn()
}))

vi.mock('@sentry/vue', () => ({ captureException: mockCaptureException }))
vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ fetchBalance: vi.fn(), fetchStatus: vi.fn() })
}))
vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => null }))
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showTopUpCreditsDialog: vi.fn() })
}))
vi.mock('@/i18n', () => ({
  t: (key: string) => key,
  st: (_key: string, fallback: string) => fallback
}))

describe('useSubscriptionActions against the real commandStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockCaptureException.mockReset()
  })

  it('reports a registered support command that throws', async () => {
    const failure = new Error('support unreachable')
    useCommandStore().registerCommand({
      id: 'Comfy.ContactSupport',
      function: () => {
        throw failure
      }
    })

    const { handleMessageSupport, isLoadingSupport } = useSubscriptionActions()
    await handleMessageSupport()

    expect(mockCaptureException).toHaveBeenCalledWith(failure, {
      tags: { error_type: 'contact_support_failed' }
    })
    expect(isLoadingSupport.value).toBe(false)
  })

  it('reports nothing when the support command succeeds', async () => {
    useCommandStore().registerCommand({
      id: 'Comfy.ContactSupport',
      function: () => {}
    })

    const { handleMessageSupport } = useSubscriptionActions()
    await handleMessageSupport()

    expect(mockCaptureException).not.toHaveBeenCalled()
  })
})
