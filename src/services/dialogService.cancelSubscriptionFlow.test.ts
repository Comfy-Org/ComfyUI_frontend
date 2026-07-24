import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  launchCancellationFlow: vi.fn(),
  showDialog: vi.fn()
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog: mocks.showDialog })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackEvent: vi.fn() })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: { value: true },
    isFreeTier: { value: false },
    type: { value: 'workspace' }
  })
}))

vi.mock('@/platform/cloud/subscription/launchCancellationFlow', () => ({
  launchCancellationFlow: mocks.launchCancellationFlow
}))

vi.mock(
  '@/components/dialog/content/subscription/CancelSubscriptionDialogContent.vue',
  () => ({ default: { name: 'CancelSubscriptionDialogContent' } })
)

import { useDialogService } from '@/services/dialogService'

describe('showCancelSubscriptionFlow delegation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('passes cancelAt and a working native fallback to the orchestrator', async () => {
    mocks.launchCancellationFlow.mockImplementation(
      async ({ cancelAt, showFallback }) => {
        expect(cancelAt).toBe('2026-08-01T00:00:00Z')
        await showFallback({ flowAlreadyOpened: true })
      }
    )

    await useDialogService().showCancelSubscriptionFlow('2026-08-01T00:00:00Z')

    expect(mocks.launchCancellationFlow).toHaveBeenCalledOnce()
    expect(mocks.showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'cancel-subscription',
        props: {
          cancelAt: '2026-08-01T00:00:00Z',
          flowAlreadyOpened: true
        }
      })
    )
  })
})
