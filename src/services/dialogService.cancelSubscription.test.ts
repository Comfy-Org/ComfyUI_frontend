import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CancellationFlowDialogOptions } from '@/platform/cloud/subscription/launchCancellationFlow'
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

function cancelSubscriptionDialog() {
  return useDialogStore().dialogStack.find(
    (dialog) => dialog.key === 'cancel-subscription'
  )
}

function opensFlowWith(options: CancellationFlowDialogOptions) {
  vi.mocked(launchCancellationFlow).mockImplementation(async ({ showFlow }) => {
    await showFlow(options)
  })
}

describe('showCancelSubscriptionFlow', () => {
  beforeEach(() => {
    vi.mocked(launchCancellationFlow).mockResolvedValue(undefined)
  })

  it('opens the flow in the cancel dialog, closable only from its steps', async () => {
    const options: CancellationFlowDialogOptions = {
      cancelAt: '2026-10-01',
      surveyId: 'survey-1',
      flow: null,
      workspaceId: 'workspace-1',
      isScopeCurrent: () => true
    }
    opensFlowWith(options)

    await useDialogService().showCancelSubscriptionFlow('2026-10-01')

    expect(launchCancellationFlow).toHaveBeenCalledWith(
      expect.objectContaining({ cancelAt: '2026-10-01' })
    )
    expect(cancelSubscriptionDialog()?.contentProps).toEqual(options)
    expect(cancelSubscriptionDialog()?.dialogComponentProps).toMatchObject({
      closable: false,
      dismissableMask: false
    })
  })

  it('does not open the flow once its workspace is no longer active', async () => {
    opensFlowWith({
      surveyId: 'survey-1',
      flow: null,
      workspaceId: 'workspace-1',
      isScopeCurrent: () => false
    })

    await useDialogService().showCancelSubscriptionFlow()

    expect(cancelSubscriptionDialog()).toBeUndefined()
  })
})
