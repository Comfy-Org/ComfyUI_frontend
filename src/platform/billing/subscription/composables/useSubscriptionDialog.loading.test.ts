import { expect, it, onTestFinished, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'
import { useDialogService } from '@/services/dialogService'

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true,
  isDesktop: false
}))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingRouting'))
vi.mock(import('@/platform/billing/composables/useBillingUI'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/services/dialogService'))
vi.mock(
  import('@/platform/billing/components/PlatformPlansLinkDialog.vue'),
  () => {
    throw new Error('plans link chunk unavailable')
  }
)
vi.mock(
  import('@/platform/billing/components/SubscriptionRequiredDialogContentUnified.vue'),
  () => {
    throw new Error('pricing chunk unavailable')
  }
)

it('declines the refusal takeover without opening an empty dialog when the pricing table fallback is on, the Plans tab is blocked and pricing cannot load', async () => {
  vi.mocked(useFeatureFlags().flags).pricingTableFallback = true
  vi.spyOn(window, 'open').mockReturnValue(null)
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

it('declines a refused run without opening an empty dialog when the Plans tab is blocked and the Plans link dialog cannot load', async () => {
  vi.mocked(useFeatureFlags().flags).billingNewUxEnabled = true
  vi.mocked(useFeatureFlags().flags).pricingTableFallback = false
  vi.spyOn(window, 'open').mockReturnValue(null)

  await expect(
    useSubscriptionDialog().showPricingTable({
      reason: 'subscribe_to_run',
      runRefused: true
    })
  ).resolves.toBe(false)

  expect(useDialogService().showLayoutDialog).not.toHaveBeenCalled()
  expect(reportError).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      cause: expect.objectContaining({
        message: 'plans link chunk unavailable'
      })
    }),
    {
      surface: 'billing',
      errorType: 'error_opening_subscription_dialog'
    }
  )
})
