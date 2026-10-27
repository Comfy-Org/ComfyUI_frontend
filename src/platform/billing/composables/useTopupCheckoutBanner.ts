import type { HostedTopupCheckout } from '@comfyorg/ingest-types'
import {
  useAsyncState,
  useDocumentVisibility,
  useIntervalFn
} from '@vueuse/core'
import { computed, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import {
  selectTopupCheckoutBanner,
  topupCheckoutBannerKey
} from '@/platform/billing/components/billingTab/topupCheckoutBanner'
import type { TopupCheckoutSnapshot } from '@/platform/billing/components/billingTab/topupCheckoutBanner'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const CREDITS_APPLYING_POLL_MS = 5_000

const NO_CHECKOUTS: TopupCheckoutSnapshot = {
  newestSessionId: null,
  checkouts: []
}

export function useTopupCheckoutBanner(enabled: MaybeRefOrGetter<boolean>) {
  const workspaceStore = useTeamWorkspaceStore()
  const workspaceScope = () =>
    `${workspaceStore.workspaceTransitionGeneration}:${workspaceStore.activeWorkspaceId}`
  const reportedSessions = new Set<string>()
  let listFailureOpen = false
  let refreshQueued = false

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
    const launchedScope = workspaceScope()
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
    if (workspaceScope() !== launchedScope) return read.state.value
    const lastKnown = new Map(
      read.state.value.checkouts.map((known) => [known.session_id, known])
    )
    return {
      newestSessionId: checkouts[0]?.session_id ?? null,
      checkouts: reads.flatMap((result, index): HostedTopupCheckout[] => {
        if (result.status === 'fulfilled') return [result.value]
        const sessionId = checkouts[index]?.session_id
        if (!sessionId) return []
        reportCheckoutReadFailure(result.reason, sessionId)
        const known = lastKnown.get(sessionId)
        return known ? [known] : []
      })
    }
  }

  const read = useAsyncState(readTopupCheckouts, NO_CHECKOUTS, {
    immediate: false,
    resetOnExecute: false
  })
  const dismissed = shallowRef<ReadonlySet<string>>(new Set())

  const banner = computed(() =>
    toValue(enabled)
      ? selectTopupCheckoutBanner(read.state.value, dismissed.value)
      : null
  )

  function dismiss() {
    if (!banner.value) return
    dismissed.value = new Set([
      ...dismissed.value,
      topupCheckoutBannerKey(banner.value)
    ])
  }

  function executeRead() {
    if (!toValue(enabled)) return
    if (read.isLoading.value) {
      refreshQueued = true
      return
    }
    void read.execute()
  }

  watch(read.isLoading, (isLoading) => {
    if (isLoading || !refreshQueued) return
    refreshQueued = false
    executeRead()
  })

  const poll = useIntervalFn(executeRead, CREDITS_APPLYING_POLL_MS, {
    immediate: false
  })
  watch(
    () =>
      toValue(enabled) &&
      read.state.value.checkouts.some(
        ({ state }) => state === 'credits_applying'
      ),
    (applying) => (applying ? poll.resume() : poll.pause())
  )

  watch(workspaceScope, () => {
    read.state.value = NO_CHECKOUTS
    dismissed.value = new Set()
    executeRead()
  })
  watch(() => toValue(enabled), executeRead, { immediate: true })
  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === 'visible') executeRead()
  })

  return { banner, dismiss }
}
