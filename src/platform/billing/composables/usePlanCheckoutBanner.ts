import type { BillingOpStatusResponse } from '@comfyorg/ingest-types'
import { useDocumentVisibility } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { planCheckoutBannerFor } from '@/platform/billing/components/billingTab/planCheckoutBanner'
import type { PlanCheckoutBanner } from '@/platform/billing/components/billingTab/planCheckoutBanner'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export function usePlanCheckoutBanner() {
  const { flags } = useFeatureFlags()
  const workspaceStore = useTeamWorkspaceStore()
  const operation = shallowRef<BillingOpStatusResponse | null>(null)
  const dismissed = shallowRef<ReadonlySet<string>>(new Set())
  const shown = computed(() => isCloud && flags.unifiedBillingSettingsEnabled)
  let refreshGeneration = 0

  const banner = computed<PlanCheckoutBanner | null>(() => {
    if (!shown.value || !operation.value) return null
    const next = planCheckoutBannerFor(operation.value)
    if (!next || dismissed.value.has(`${next.opId}:${next.kind}`)) return null
    return next
  })

  function currentRefreshIs(refreshId: number, launchedGeneration: number) {
    return (
      refreshId === refreshGeneration &&
      workspaceStore.workspaceTransitionGeneration === launchedGeneration
    )
  }

  async function refresh() {
    const launchedGeneration = workspaceStore.workspaceTransitionGeneration
    const refreshId = ++refreshGeneration
    if (!shown.value) {
      operation.value = null
      return
    }
    try {
      const status = await workspaceApi.getBillingStatus()
      if (!currentRefreshIs(refreshId, launchedGeneration)) return
      const opId = status.latest_subscription_op_id
      const nextOperation = opId
        ? await workspaceApi.getBillingOpStatus(opId)
        : null
      if (!currentRefreshIs(refreshId, launchedGeneration)) return
      operation.value = nextOperation
    } catch (error) {
      if (!currentRefreshIs(refreshId, launchedGeneration)) return
      reportError(error, {
        errorType: 'plan_checkout_banner_read_failed',
        surface: 'billing'
      })
    }
  }

  function dismiss() {
    if (!banner.value) return
    dismissed.value = new Set([
      ...dismissed.value,
      `${banner.value.opId}:${banner.value.kind}`
    ])
  }

  void refresh()
  watch(
    () => workspaceStore.workspaceTransitionGeneration,
    () => {
      refreshGeneration++
      operation.value = null
      dismissed.value = new Set()
      void refresh()
    }
  )
  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === 'visible') void refresh()
  })
  watch(shown, () => {
    void refresh()
  })

  return { banner, dismiss }
}
