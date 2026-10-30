import { expect, it, onTestFinished, vi } from 'vitest'

import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useDialogService } from '@/services/dialogService'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingRouting'))
vi.mock(import('@/platform/billing/composables/useBillingUI'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/services/dialogService'))
vi.mock(
  import('@/platform/billing/subscription/components/SubscriptionRequiredDialogContent.vue'),
  () => {
    throw new Error('pricing chunk unavailable')
  }
)

it('declines the refusal takeover without opening an empty dialog when pricing cannot load', async () => {
  const originalConfig = window.__CONFIG__
  window.__CONFIG__ = { subscription_required: true }
  onTestFinished(() => {
    window.__CONFIG__ = originalConfig
  })

  await expect(
    useBillingDialogs().showSubscriptionRequiredDialog()
  ).resolves.toBe(false)

  expect(useDialogService().showLayoutDialog).not.toHaveBeenCalled()
  expect(reportError).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      cause: expect.objectContaining({ message: 'pricing chunk unavailable' })
    }),
    {
      surface: 'billing',
      errorType: 'error_opening_subscription_dialog'
    }
  )
})
