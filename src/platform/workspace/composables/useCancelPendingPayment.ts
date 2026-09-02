import { onScopeDispose, ref } from 'vue'

import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

/**
 * The cancel-payment outcome machine, shared by every dialog that offers to
 * cancel a pending billing operation. `cancelOperation`'s three verdicts map
 * to state the host renders: 'unavailable' is a considered refusal — the
 * charge is past cancelling; 'unreachable' reached no verdict, so the
 * affordance stays live; 'canceled' leaves navigation to the host, with
 * `showCanceledNotice` surfacing the confirmation for five seconds.
 */
export function useCancelPendingPayment() {
  const billingOperationStore = useBillingOperationStore()
  const isCancelingPayment = ref(false)
  const cancelUnavailable = ref(false)
  const cancelUnreachable = ref(false)
  const canceledNoticeVisible = ref(false)
  let canceledNoticeTimer: ReturnType<typeof setTimeout> | undefined

  function resetCancelVerdict() {
    cancelUnavailable.value = false
    cancelUnreachable.value = false
  }

  function showCanceledNotice() {
    canceledNoticeVisible.value = true
    clearTimeout(canceledNoticeTimer)
    canceledNoticeTimer = setTimeout(() => {
      canceledNoticeVisible.value = false
    }, 5000)
  }

  async function cancelPendingPayment(
    opId: string
  ): Promise<'canceled' | 'unavailable' | 'unreachable' | null> {
    if (isCancelingPayment.value) return null
    isCancelingPayment.value = true
    try {
      const result = await billingOperationStore.cancelOperation(opId)
      if (result === 'unavailable') {
        cancelUnreachable.value = false
        cancelUnavailable.value = true
        return result
      }
      if (result === 'unreachable') {
        cancelUnreachable.value = true
        return result
      }
      resetCancelVerdict()
      return result
    } finally {
      isCancelingPayment.value = false
    }
  }

  onScopeDispose(() => clearTimeout(canceledNoticeTimer))

  return {
    isCancelingPayment,
    cancelUnavailable,
    cancelUnreachable,
    canceledNoticeVisible,
    cancelPendingPayment,
    showCanceledNotice,
    resetCancelVerdict
  }
}
