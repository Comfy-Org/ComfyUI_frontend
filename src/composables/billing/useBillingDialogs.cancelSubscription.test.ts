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

import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'

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

    await useBillingDialogs().showCancelSubscriptionFlow('2026-10-01')

    expect(launchCancellationFlow).toHaveBeenCalledWith(
      expect.objectContaining({ cancelAt: '2026-10-01' })
    )
    expect(cancelSubscriptionDialog()?.contentProps).toEqual(options)
    expect(cancelSubscriptionDialog()?.dialogComponentProps).toMatchObject({
      closable: false,
      dismissOnPointerDownOutside: false
    })
  })

  it('does not open the flow once its workspace is no longer active', async () => {
    opensFlowWith({
      surveyId: 'survey-1',
      flow: null,
      workspaceId: 'workspace-1',
      isScopeCurrent: () => false
    })

    await useBillingDialogs().showCancelSubscriptionFlow()

    expect(cancelSubscriptionDialog()).toBeUndefined()
  })
})

describe('showCancelSubscriptionDialog', () => {
  it('preserves an existing cancellation scope guard for public callers', async () => {
    const dialogStore = useDialogStore()
    const existingGuard = () => false
    dialogStore.showDialog({
      key: 'cancel-subscription',
      component: { render: () => null },
      props: {
        cancelAt: '2026-10-01',
        flowAlreadyOpened: true,
        isScopeCurrent: existingGuard
      }
    })

    const shown = await useBillingDialogs().showCancelSubscriptionDialog()

    expect(shown).toBe(dialogStore.dialogStack[0])
    expect(dialogStore.dialogStack[0].contentProps).toMatchObject({
      cancelAt: '2026-10-01',
      flowAlreadyOpened: true,
      isScopeCurrent: existingGuard
    })
  })

  it('declines a guarded cancellation dialog after its scope changes', async () => {
    const dialogStore = useDialogStore()

    await expect(
      useBillingDialogs().showCancelSubscriptionDialog(
        undefined,
        true,
        () => false
      )
    ).resolves.toBe(false)
    expect(dialogStore.dialogStack).toHaveLength(0)
  })
})
