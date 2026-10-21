import type { HostedTopupCheckout } from '@comfyorg/ingest-types'
import { shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { ProcessingTopupPayment } from '@/platform/billing/processingTopupPayment'
import { processingTopupPayment } from '@/platform/billing/processingTopupPayment'

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
    return {
      ok: true,
      read: {
        payment: processingTopupPayment(sessions),
        sessionFailures
      }
    }
  } catch (cause) {
    return { ok: false, cause }
  }
}

function reportCheckoutReadFailure(cause: unknown) {
  reportError(cause, {
    errorType: 'topup_checkout_read_failed',
    surface: 'billing'
  })
}

export function useProcessingTopupPayment(enabled: MaybeRefOrGetter<boolean>) {
  const payment = shallowRef<ProcessingTopupPayment | null>(null)
  let generation = 0

  async function load() {
    const current = ++generation
    if (!toValue(enabled)) {
      payment.value = null
      return
    }

    const outcome = await readProcessingTopupPayment()
    if (current !== generation || !toValue(enabled)) return
    if (!outcome.ok) {
      reportCheckoutReadFailure(outcome.cause)
      payment.value = null
      return
    }

    for (const cause of outcome.read.sessionFailures)
      reportCheckoutReadFailure(cause)
    payment.value = outcome.read.payment
  }

  watch(
    () => toValue(enabled),
    () => void load(),
    { immediate: true }
  )

  return { payment }
}
