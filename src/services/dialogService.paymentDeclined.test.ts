import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())
const closeDialog = vi.hoisted(() => vi.fn())
const state = vi.hoisted(() => ({ billingControlEnabled: true }))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog, closeDialog })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackEvent: vi.fn() })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get billingControlEnabled() {
        return state.billingControlEnabled
      }
    }
  })
}))

import { useDialogService } from '@/services/dialogService'

describe('showPaymentDeclinedDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.billingControlEnabled = true
  })

  it('stacks over the originating flow and only closes its own surface', async () => {
    await useDialogService().showPaymentDeclinedDialog({
      origin: 'topup',
      reason: 'Insufficient funds'
    })

    const [args] = showDialog.mock.calls[0]
    expect(args).toMatchObject({
      key: 'payment-declined',
      props: {
        origin: 'topup',
        reason: 'Insufficient funds'
      },
      dialogComponentProps: {
        renderer: 'reka',
        headless: true
      }
    })
    expect(closeDialog).not.toHaveBeenCalled()

    args.props.onClose()
    expect(closeDialog).toHaveBeenCalledExactlyOnceWith({
      key: 'payment-declined'
    })
  })

  it('stays unavailable outside the Billing V1 rollout', async () => {
    state.billingControlEnabled = false
    await useDialogService().showPaymentDeclinedDialog({
      origin: 'subscription',
      reason: 'Insufficient funds'
    })

    expect(showDialog).not.toHaveBeenCalled()
  })
})
