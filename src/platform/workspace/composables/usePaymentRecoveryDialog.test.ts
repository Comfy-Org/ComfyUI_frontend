import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { reportError } from '@/platform/telemetry/reportError'
import { canManageBillingFact } from '@/platform/workspace/composables/__mocks__/useBillingCapabilities'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { usePaymentRecoveryDialog } from '@/platform/workspace/composables/usePaymentRecoveryDialog'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(import('@/services/dialogService'))
vi.mock(import('@/composables/useErrorHandling'))
vi.mock(import('@/platform/telemetry/reportError'))

describe('usePaymentRecoveryDialog', () => {
  beforeEach(() => {
    vi.mocked(useBillingContext).mockReturnValue(useBillingContext())
  })

  it.for([true, false])(
    'opens the headless recovery dialog offering the portal when billing management is %s',
    (granted) => {
      useBillingCapabilities().canManageBilling = canManageBillingFact(granted)

      usePaymentRecoveryDialog().showPaymentRecoveryDialog()

      const [args] = vi.mocked(useDialogService().showLayoutDialog).mock
        .calls[0]
      expect(args).toMatchObject({
        key: 'subscription-paused',
        props: {
          canManage: granted,
          status: 'payment_failed',
          isUpdatingPayment: false
        },
        dialogComponentProps: { headless: true }
      })
    }
  )

  it('closes the recovery dialog once the billing portal opens', async () => {
    await usePaymentRecoveryDialog().updatePayment()

    expect(useBillingContext().manageSubscription).toHaveBeenCalledOnce()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'subscription-paused'
    })
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a failed portal request once and shows it as a toast', async () => {
    const failure = new Error('portal down')
    vi.mocked(useBillingContext().manageSubscription).mockRejectedValueOnce(
      failure
    )

    await expect(
      usePaymentRecoveryDialog().updatePayment()
    ).resolves.toBeUndefined()

    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      surface: 'billing',
      errorType: 'payment_recovery_portal_failure'
    })
    expect(
      useErrorHandling().toastErrorHandler
    ).toHaveBeenCalledExactlyOnceWith(failure)
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
  })

  it('shares one in-flight portal request across callers', async () => {
    let resolvePortal = () => {}
    const billing = useBillingContext()
    vi.mocked(billing.manageSubscription).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolvePortal = resolve
      })
    )
    const recovery = usePaymentRecoveryDialog()

    const first = recovery.updatePayment()
    const second = recovery.updatePayment()

    expect(recovery.isUpdatingPayment.value).toBe(true)
    expect(billing.manageSubscription).toHaveBeenCalledOnce()

    resolvePortal()
    await Promise.all([first, second])

    expect(recovery.isUpdatingPayment.value).toBe(false)
  })
})
