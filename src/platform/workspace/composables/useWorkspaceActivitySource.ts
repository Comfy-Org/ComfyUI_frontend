import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { BillingEvent } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { ActivityEvent } from '@/platform/workspace/composables/useWorkspaceActivity'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  billingEventToActivity,
  isUsageEvent
} from '@/platform/workspace/utils/billingEventToActivity'

export function useWorkspaceActivitySource() {
  const { t } = useI18n()
  const workspaceStore = useTeamWorkspaceStore()
  const { members } = storeToRefs(workspaceStore)
  const rawEvents = ref<BillingEvent[]>([])
  const isLoading = ref(false)
  const error = ref<unknown>(null)

  function resolveUserName(userId: string | undefined): string {
    if (!userId) return ''
    const member = members.value.find(({ id }) => id === userId)
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
    } catch (cause) {
      error.value = cause
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
