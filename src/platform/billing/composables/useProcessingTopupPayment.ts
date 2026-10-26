import type { HostedTopupCheckout } from '@comfyorg/ingest-types'
import { onScopeDispose, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { ProcessingTopupPayment } from '@/platform/billing/processingTopupPayment'
import { processingTopupPayment } from '@/platform/billing/processingTopupPayment'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'

interface ProcessingTopupRead {
  checkouts: HostedTopupCheckout[]
  sessionFailures: unknown[]
}

async function readProcessingTopupCheckouts(
  lastKnown: ReadonlyMap<string, HostedTopupCheckout>
): Promise<
  { ok: true; read: ProcessingTopupRead } | { ok: false; cause: unknown }
> {
  try {
    const { checkouts: listed } = await workspaceApi.listTopupCheckouts()
    const reads = await Promise.allSettled(
      listed.map(({ session_id }) => workspaceApi.getTopupCheckout(session_id))
    )
    const checkouts: HostedTopupCheckout[] = []
    const sessionFailures: unknown[] = []
    reads.forEach((read, index) => {
      if (read.status === 'fulfilled') {
        checkouts.push(read.value)
        return
      }
      sessionFailures.push(read.reason)
      const known = lastKnown.get(listed[index].session_id)
      if (known) checkouts.push(known)
    })
    return { ok: true, read: { checkouts, sessionFailures } }
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
  const workspaceStore = useTeamWorkspaceStore()
  const workspaceScope = () =>
    `${workspaceStore.workspaceTransitionGeneration}:${workspaceStore.activeWorkspaceId}`
  const payment = shallowRef<ProcessingTopupPayment | null>(null)
  let knownCheckouts = new Map<string, HostedTopupCheckout>()
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

  function clear() {
    payment.value = null
    knownCheckouts = new Map()
  }

  function reading() {
    return !disposed && toValue(shown) && flags.unifiedBillingSettingsEnabled
  }

  async function load() {
    const current = ++generation
    if (!reading()) {
      clear()
      return
    }

    const outcome = await readProcessingTopupCheckouts(knownCheckouts)
    if (current !== generation || !reading()) return
    if (!outcome.ok) {
      if (isBillingOwnerRequired(outcome.cause)) {
        clear()
        return
      }
      reportCheckoutReadFailure(outcome.cause)
      return
    }

    const { checkouts, sessionFailures } = outcome.read
    for (const cause of sessionFailures) reportCheckoutReadFailure(cause)
    knownCheckouts = new Map(
      checkouts.map((known) => [known.session_id, known])
    )
    const servedPayment = processingTopupPayment(checkouts)
    payment.value =
      servedPayment !== null && sessionFailures.length > 0
        ? { paymentAmountCents: null }
        : servedPayment
  }

  watch(workspaceScope, () => {
    clear()
    void load()
  })
  watch(reading, () => void load(), { immediate: true })
  const stopRefreshOnReturn = registerRefreshOnReturn(load)
  onScopeDispose(() => {
    disposed = true
    stopRefreshOnReturn()
  })

  return { payment }
}
