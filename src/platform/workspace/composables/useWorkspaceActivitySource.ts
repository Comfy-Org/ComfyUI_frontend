import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { BillingEvent, GetBillingEventsData } from '@comfyorg/ingest-types'

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { ActivityEvent } from '@/platform/workspace/composables/useWorkspaceActivity'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  billingEventToActivity,
  isUsageEvent
} from '@/platform/workspace/utils/billingEventToActivity'

type BillingEventScope = NonNullable<
  NonNullable<GetBillingEventsData['query']>['scope']
>

const BILLING_EVENTS_PAGE_LIMIT = 100

export function useWorkspaceActivitySource() {
  const { t } = useI18n()
  const { workspaceRole } = useWorkspaceUI()
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

  async function fetchAllEvents(scope: BillingEventScope) {
    const events: BillingEvent[] = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const response = await workspaceApi.getBillingEvents({
        page,
        limit: BILLING_EVENTS_PAGE_LIMIT,
        scope
      })
      events.push(...response.events)
      totalPages = response.totalPages
      page++
    }

    return events
  }

  async function refresh() {
    isLoading.value = true
    error.value = null
    try {
      await workspaceStore.ensureMembersLoaded()
      rawEvents.value = await fetchAllEvents(
        workspaceRole.value === 'owner' ? 'workspace' : 'self'
      )
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
