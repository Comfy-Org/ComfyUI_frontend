import {
  useAsyncState,
  useDocumentVisibility,
  useIntervalFn
} from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { HostedTopupCheckout } from '@/platform/workspace/api/workspaceApi'
import {
  selectTopupCheckoutBanner,
  topupCheckoutBannerKey
} from '@/platform/workspace/components/dialogs/settings/billing/topupCheckoutBanner'
import type { TopupCheckoutSnapshot } from '@/platform/workspace/components/dialogs/settings/billing/topupCheckoutBanner'

const CREDITS_APPLYING_POLL_MS = 5_000

const NO_CHECKOUTS: TopupCheckoutSnapshot = {
  newestSessionId: null,
  checkouts: []
}

export function useTopupCheckoutBanner() {
  const reportedSessions = new Set<string>()
  let listFailureOpen = false

  function reportCheckoutReadFailure(error: unknown, key: string) {
    if (key === 'list') {
      if (listFailureOpen) return
      listFailureOpen = true
    } else if (reportedSessions.has(key)) {
      return
    } else {
      reportedSessions.add(key)
    }
    reportError(error, {
      errorType: 'topup_checkout_read_failed',
      surface: 'billing'
    })
  }

  async function readTopupCheckouts(): Promise<TopupCheckoutSnapshot> {
    let listed: Awaited<ReturnType<typeof workspaceApi.listTopupCheckouts>>
    try {
      listed = await workspaceApi.listTopupCheckouts()
      listFailureOpen = false
    } catch (error) {
      reportCheckoutReadFailure(error, 'list')
      throw error
    }
    const { checkouts } = listed
    const reads = await Promise.allSettled(
      checkouts.map(({ session_id }) =>
        workspaceApi.getTopupCheckout(session_id)
      )
    )
    return {
      newestSessionId: checkouts[0]?.session_id ?? null,
      checkouts: reads.flatMap((read, index): HostedTopupCheckout[] => {
        if (read.status === 'fulfilled') return [read.value]
        const sessionId = checkouts[index]?.session_id
        if (sessionId) reportCheckoutReadFailure(read.reason, sessionId)
        return []
      })
    }
  }

  const read = useAsyncState(readTopupCheckouts, NO_CHECKOUTS, {
    resetOnExecute: false
  })
  const dismissed = shallowRef<ReadonlySet<string>>(new Set())

  const banner = computed(() =>
    selectTopupCheckoutBanner(read.state.value, dismissed.value)
  )

  function dismiss() {
    if (!banner.value) return
    dismissed.value = new Set([
      ...dismissed.value,
      topupCheckoutBannerKey(banner.value)
    ])
  }

  const poll = useIntervalFn(
    () => void read.execute(),
    CREDITS_APPLYING_POLL_MS,
    { immediate: false }
  )
  watch(
    () =>
      read.state.value.checkouts.some(
        ({ state }) => state === 'credits_applying'
      ),
    (applying) => (applying ? poll.resume() : poll.pause())
  )

  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === 'visible') void read.execute()
  })

  return { banner, dismiss }
}
