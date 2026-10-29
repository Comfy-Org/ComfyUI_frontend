import { expect, it, onTestFinished, vi } from 'vitest'

import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'
import { reportError } from '@/platform/telemetry/reportError'
import { useDialogService } from '@/services/dialogService'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/composables/billing/useBillingRouting'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/services/dialogService'))
vi.mock(
  import('@/platform/cloud/subscription/components/SubscriptionRequiredDialogContent.vue'),
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
