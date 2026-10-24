import type { HostedTopupCheckout } from '@comfyorg/ingest-types'
import { onScopeDispose, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'
import type { ProcessingTopupPayment } from '@/platform/billing/processingTopupPayment'
import { processingTopupPayment } from '@/platform/billing/processingTopupPayment'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'

interface ProcessingTopupRead {
  payment: ProcessingTopupPayment | null
  sessionFailures: unknown[]
}

async function readProcessingTopupPayment(): Promise<
  { ok: true; read: ProcessingTopupRead } | { ok: false; cause: unknown }
> {
  try {
    const { checkouts } = await workspaceApi.listTopupCheckouts()
    const reads = await Promise.allSettled(
      checkouts.map(({ session_id }) =>
        workspaceApi.getTopupCheckout(session_id)
      )
    )
    const sessions: HostedTopupCheckout[] = []
    const sessionFailures: unknown[] = []
    for (const read of reads) {
      if (read.status === 'fulfilled') sessions.push(read.value)
      else sessionFailures.push(read.reason)
    }
    const knownPayment = processingTopupPayment(sessions)
    const payment =
      knownPayment !== null && sessionFailures.length > 0
        ? { paymentAmountCents: null }
        : knownPayment
    return {
      ok: true,
      read: {
        payment,
        sessionFailures
      }
    }
  } catch (cause) {
    return { ok: false, cause }
  }
}

function isBillingOwnerRequired(cause: unknown) {
  return cause instanceof WorkspaceApiError && cause.status === 403
}

export function useProcessingTopupPayment(
  shown: MaybeRefOrGetter<boolean> = true
) {
  const { flags } = useFeatureFlags()
  const payment = shallowRef<ProcessingTopupPayment | null>(null)
  let generation = 0
  let disposed = false
  let failureReported = false

  function reportCheckoutReadFailure(cause: unknown) {
    if (failureReported) return
    failureReported = true
    reportError(cause, {
      errorType: 'failure_reading_topup_checkout',
      surface: 'billing'
    })
  }

  function reading() {
    return !disposed && toValue(shown) && flags.unifiedBillingSettingsEnabled
  }

  async function load() {
    const current = ++generation
    if (!reading()) {
      payment.value = null
      return
    }

    const outcome = await readProcessingTopupPayment()
    if (current !== generation || !reading()) return
    if (!outcome.ok) {
      if (isBillingOwnerRequired(outcome.cause)) {
        payment.value = null
        return
      }
      reportCheckoutReadFailure(outcome.cause)
      return
    }

    for (const cause of outcome.read.sessionFailures)
      reportCheckoutReadFailure(cause)
    payment.value = outcome.read.payment
  }

  watch(reading, () => void load(), { immediate: true })
  const stopRefreshOnReturn = registerRefreshOnReturn(load)
  onScopeDispose(() => {
    disposed = true
    stopRefreshOnReturn()
  })

  return { payment }
}
