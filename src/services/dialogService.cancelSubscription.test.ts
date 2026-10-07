import { beforeEach, describe, expect, it, vi } from 'vitest'

import { launchCancellationFlow } from '@/platform/cloud/subscription/launchCancellationFlow'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/i18n'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false
}))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/cloud/subscription/launchCancellationFlow'))

import { useDialogService } from '@/services/dialogService'

function cancelSubscriptionContentProps() {
  return useDialogStore().dialogStack.find(
    (dialog) => dialog.key === 'cancel-subscription'
  )?.contentProps
}

describe('showCancelSubscriptionFlow native fallback', () => {
  beforeEach(() => {
    vi.mocked(launchCancellationFlow).mockResolvedValue(undefined)
  })

  it.for([
    {
      name: 'a flow the provider opened and the customer confirmed',
      handed: { flowAlreadyOpened: true, flowAlreadyConfirmed: true },
      shown: { flowAlreadyOpened: true, flowAlreadyConfirmed: true }
    },
    {
      name: 'a flow the provider opened and the customer never confirmed',
      handed: { flowAlreadyOpened: true },
      shown: { flowAlreadyOpened: true, flowAlreadyConfirmed: false }
    },
    {
      name: 'a flow the provider never opened',
      handed: {},
      shown: { flowAlreadyOpened: false, flowAlreadyConfirmed: false }
    }
  ])('hands the dialog $name', async ({ handed, shown }) => {
    vi.mocked(launchCancellationFlow).mockImplementation(
      async ({ showFallback }) => {
        await showFallback(handed)
      }
    )

    await useDialogService().showCancelSubscriptionFlow('2026-10-01')

    expect(cancelSubscriptionContentProps()).toMatchObject({
      cancelAt: '2026-10-01',
      ...shown
    })
  })
})
