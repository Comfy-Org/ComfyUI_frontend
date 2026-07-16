import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ActivityEvent } from '@/platform/workspace/composables/useWorkspaceActivity'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { BillingEventInput } from '@/platform/workspace/utils/billingEventToActivity'
import {
  billingEventToActivity,
  isUsageEvent
} from '@/platform/workspace/utils/billingEventToActivity'

/**
 * Live data source for the workspace Activity ledger (FE-1249): fetches the
 * per-workspace usage feed (`GET /api/billing/events`), keeps only usage rows,
 * and maps them to the ledger's `ActivityEvent` shape, resolving member names
 * from the workspace store so the mapping updates once members load.
 */
export function useWorkspaceActivitySource() {
  const { t } = useI18n()
  const workspaceStore = useTeamWorkspaceStore()
  const { members } = storeToRefs(workspaceStore)

  const rawEvents = ref<BillingEventInput[]>([])
  const isLoading = ref(false)
  const error = ref<unknown>(null)

  function resolveUserName(userId: string | undefined): string {
    if (!userId) return ''
    const member = members.value.find((m) => m.id === userId)
    return member?.name || member?.email || userId
  }

  const events = computed<ActivityEvent[]>(() => {
    const labels = {
      cloudRun: t('workspacePanel.activity.eventType.cloudRun'),
      partnerNode: t('workspacePanel.activity.eventType.partnerNode')
    }
    return rawEvents.value
      .filter(isUsageEvent)
      .map((event) => billingEventToActivity(event, resolveUserName, labels))
  })

  async function refresh() {
    isLoading.value = true
    error.value = null
    try {
      const response = await workspaceApi.getBillingEvents()
      rawEvents.value = response.events
    } catch (err) {
      error.value = err
      rawEvents.value = []
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    void refresh()
  })

  return { events, isLoading, error, refresh }
}
