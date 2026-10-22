import type { BillingOpStatusResponse } from '@comfyorg/ingest-types'
import { useDocumentVisibility } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { planCheckoutBannerFor } from '@/platform/workspace/components/dialogs/settings/billing/planCheckoutBanner'
import type { PlanCheckoutBanner } from '@/platform/workspace/components/dialogs/settings/billing/planCheckoutBanner'

export function usePlanCheckoutBanner() {
  const { flags } = useFeatureFlags()
  const operation = shallowRef<BillingOpStatusResponse | null>(null)
  const dismissed = shallowRef<ReadonlySet<string>>(new Set())
  const shown = computed(() => isCloud && flags.unifiedBillingSettingsEnabled)

  const banner = computed<PlanCheckoutBanner | null>(() => {
    if (!shown.value || !operation.value) return null
    const next = planCheckoutBannerFor(operation.value)
    if (!next || dismissed.value.has(`${next.opId}:${next.kind}`)) return null
    return next
  })

  async function refresh() {
    if (!shown.value) {
      operation.value = null
      return
    }
    try {
      const status = await workspaceApi.getBillingStatus()
      const opId = status.latest_subscription_op_id
      operation.value = opId
        ? await workspaceApi.getBillingOpStatus(opId)
        : null
    } catch (error) {
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
  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === 'visible') void refresh()
  })
  watch(shown, () => {
    void refresh()
  })

  return { banner, dismiss }
}
