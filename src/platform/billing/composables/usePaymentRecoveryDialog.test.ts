import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { BillingPortalOutcome } from '@/platform/billing/composables/types'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { reportError } from '@/platform/telemetry/reportError'
import {
  canManageBillingFact,
  paymentRecoveryAvailableFact,
  runWorkflowsDenialFact
} from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
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

  it.for<{ outcome: BillingPortalOutcome; calls: number }>([
    { outcome: { ok: true }, calls: 1 },
    { outcome: { ok: false, reason: 'blocked' }, calls: 0 }
  ])(
    'notifies the opener only when the portal opens from the dialog ($outcome.ok)',
    async ({ outcome, calls }) => {
      vi.mocked(useBillingContext().manageSubscription).mockResolvedValueOnce(
        outcome
      )
      const onPortalOpened = vi.fn()

      usePaymentRecoveryDialog().showPaymentRecoveryDialog(onPortalOpened)
      const [args] = vi.mocked(useDialogService().showLayoutDialog).mock
        .calls[0]
      assert('onUpdatePayment' in args.props)
      assert(typeof args.props.onUpdatePayment === 'function')
      await args.props.onUpdatePayment()

      expect(onPortalOpened).toHaveBeenCalledTimes(calls)
    }
  )

  it.for([
    { available: true, denial: 'payment_past_due', lock: 'owner' },
    { available: false, denial: 'payment_past_due', lock: 'member' },
    { available: false, denial: 'no_funds', lock: null },
    { available: false, denial: undefined, lock: null }
  ] as const)(
    'locks for recovery as $lock when payment_recovery_available is $available and can_run_workflows is denied for $denial',
    ({ available, denial, lock }) => {
      const capabilities = useBillingCapabilities()
      capabilities.paymentRecoveryAvailable =
        paymentRecoveryAvailableFact(available)
      capabilities.runWorkflowsDenial = runWorkflowsDenialFact(denial)

      expect(usePaymentRecoveryDialog().paymentRecoveryLock.value).toBe(lock)
    }
  )

  it('clears the recovery lock once refreshed capabilities drop the fact', async () => {
    const capabilities = useBillingCapabilities()
    const available = ref(true)
    capabilities.paymentRecoveryAvailable =
      paymentRecoveryAvailableFact(available)
    vi.mocked(capabilities.refresh).mockImplementationOnce(async () => {
      available.value = false
    })
    const recovery = usePaymentRecoveryDialog()
    expect(recovery.paymentRecoveryLock.value).toBe('owner')

    await recovery.refreshCapabilities()

    expect(recovery.paymentRecoveryLock.value).toBeNull()
  })

  it('closes the recovery dialog once the billing portal opens', async () => {
    await expect(usePaymentRecoveryDialog().updatePayment()).resolves.toEqual({
      ok: true
    })

    expect(useBillingContext().manageSubscription).toHaveBeenCalledOnce()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'subscription-paused'
    })
    expect(reportError).not.toHaveBeenCalled()
  })

  it.for(['routing_unavailable', 'blocked', 'missing_url', 'failed'] as const)(
    'keeps the recovery dialog open when the portal did not open (%s)',
    async (reason) => {
      vi.mocked(useBillingContext().manageSubscription).mockResolvedValueOnce({
        ok: false,
        reason
      })

      await expect(usePaymentRecoveryDialog().updatePayment()).resolves.toEqual(
        { ok: false, reason }
      )

      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it('reports a failed portal request once, shows it as a toast, and frees the retry', async () => {
    const failure = new Error('portal down')
    vi.mocked(useBillingContext().manageSubscription).mockRejectedValueOnce(
      failure
    )
    const recovery = usePaymentRecoveryDialog()

    await expect(recovery.updatePayment()).resolves.toEqual({
      ok: false,
      reason: 'failed'
    })

    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      surface: 'billing',
      errorType: 'payment_recovery_portal_failure'
    })
    expect(
      useErrorHandling().toastErrorHandler
    ).toHaveBeenCalledExactlyOnceWith(failure)
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    expect(recovery.isUpdatingPayment.value).toBe(false)

    await recovery.updatePayment()
    expect(useBillingContext().manageSubscription).toHaveBeenCalledTimes(2)
  })

  it('reopens the dialog showing the portal request still in flight', async () => {
    let resolvePortal: (outcome: BillingPortalOutcome) => void = () => {}
    vi.mocked(useBillingContext().manageSubscription).mockReturnValueOnce(
      new Promise<BillingPortalOutcome>((resolve) => {
        resolvePortal = resolve
      })
    )
    const recovery = usePaymentRecoveryDialog()
    const request = recovery.updatePayment()

    recovery.showPaymentRecoveryDialog()

    const [args] = vi.mocked(useDialogService().showLayoutDialog).mock.calls[0]
    expect(args.props).toMatchObject({ isUpdatingPayment: true })
    resolvePortal({ ok: true })
    await request
    expect(useDialogStore().updateDialog).toHaveBeenLastCalledWith({
      key: 'subscription-paused',
      contentProps: { isUpdatingPayment: false }
    })
  })

  it('shares one in-flight portal request across callers', async () => {
    let resolvePortal: (outcome: BillingPortalOutcome) => void = () => {}
    const billing = useBillingContext()
    vi.mocked(billing.manageSubscription).mockReturnValueOnce(
      new Promise<BillingPortalOutcome>((resolve) => {
        resolvePortal = resolve
      })
    )
    const recovery = usePaymentRecoveryDialog()

    const first = recovery.updatePayment()
    const second = recovery.updatePayment()

    expect(recovery.isUpdatingPayment.value).toBe(true)
    expect(billing.manageSubscription).toHaveBeenCalledOnce()

    resolvePortal({ ok: true })
    await Promise.all([first, second])

    expect(recovery.isUpdatingPayment.value).toBe(false)
  })
})
