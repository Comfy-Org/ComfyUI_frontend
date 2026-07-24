import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog })
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
    type: { value: 'legacy' }
  })
}))

vi.mock('@/platform/cloud/subscription/launchCancellationFlow', () => {
  throw new Error('chunk failed to load')
})

vi.mock(
  '@/components/dialog/content/subscription/CancelSubscriptionDialogContent.vue',
  () => ({ default: { name: 'CancelSubscriptionDialogContent' } })
)

import { useDialogService } from '@/services/dialogService'

describe('showCancelSubscriptionFlow', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('falls back to the native dialog when its module fails to load', async () => {
    await useDialogService().showCancelSubscriptionFlow('2026-08-01T00:00:00Z')

    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'cancel-subscription',
        props: {
          cancelAt: '2026-08-01T00:00:00Z',
          flowAlreadyOpened: false
        }
      })
    )
  })
})
