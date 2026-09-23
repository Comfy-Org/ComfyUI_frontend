<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center p-8">
      <Spinner />
    </div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">{{ error }}</Message>
    </div>
    <DataTable
      v-else
      :value="events"
      :paginator="true"
      :rows="pagination.limit"
      :total-records="pagination.total"
      :first="dataTableFirst"
      :lazy="true"
      class="p-datatable-sm custom-datatable"
      @page="onPageChange"
    >
      <Column field="event_type" :header="$t('credits.eventType')">
        <template #body="{ data }">
          <Badge
            variant="badge"
            :severity="customerEventService.getEventSeverity(data.event_type)"
          >
            {{ customerEventService.formatEventType(data.event_type) }}
          </Badge>
        </template>
      </Column>
      <Column field="details" :header="$t('credits.details')">
        <template #body="{ data }">
          <div class="event-details">
            <!-- Credits Added -->
            <template v-if="data.event_type === EventType.CREDIT_ADDED">
              <div class="font-semibold text-green-500">
                {{ $t('credits.added') }} ${{
                  customerEventService.formatAmount(data.params?.amount)
                }}
              </div>
            </template>

            <!-- Account Created -->
            <template v-else-if="data.event_type === EventType.ACCOUNT_CREATED">
              <div>{{ $t('credits.accountInitialized') }}</div>
            </template>

            <!-- API Usage -->
            <template
              v-else-if="data.event_type === EventType.API_USAGE_COMPLETED"
            >
              <div class="flex flex-col gap-1">
                <div class="font-semibold">
                  {{ data.params?.api_name || 'API' }}
                </div>
                <div class="text-sm text-smoke-400">
                  {{ $t('credits.model') }}: {{ data.params?.model || '-' }}
                </div>
              </div>
            </template>
          </div>
        </template>
      </Column>
      <Column field="createdAt" :header="$t('credits.time')">
        <template #body="{ data }">
          {{ customerEventService.formatDate(data.createdAt) }}
        </template>
      </Column>
      <Column field="params" :header="$t('credits.additionalInfo')">
        <template #body="{ data }">
          <Button
            v-if="customerEventService.hasAdditionalInfo(data)"
            v-tooltip.top="{
              escape: false,
              value: tooltipContentMap.get(data.event_id) || '',
              pt: {
                text: {
                  style: {
                    width: 'max-content !important'
                  }
                }
              }
            }"
            variant="textonly"
            size="icon-sm"
            :aria-label="$t('credits.additionalInfo')"
          >
            <i class="pi pi-info-circle" />
          </Button>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import Message from '@/components/ui/message/Message.vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { usePendingTopup } from '@/composables/billing/usePendingTopup'
import { useTelemetry } from '@/platform/telemetry'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { readOnRail } from '@/platform/workspace/composables/readOnRail'
import { useBillingReadRail } from '@/platform/workspace/composables/useBillingReadRail'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { AuditLog } from '@/services/customerEventsService'
import {
  EventType,
  useCustomerEventsService
} from '@/services/customerEventsService'

const { t } = useI18n()

const events = ref<AuditLog[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const customerEventService = useCustomerEventsService()

const { shouldUseWorkspaceBilling } = useBillingRouting()

const pagination = ref({
  page: 1,
  limit: 7,
  total: 0,
  totalPages: 0
})

const dataTableFirst = computed(
  () => (pagination.value.page - 1) * pagination.value.limit
)

const tooltipContentMap = computed(() => {
  const map = new Map<string, string>()
  events.value.forEach((event) => {
    if (customerEventService.hasAdditionalInfo(event) && event.event_id) {
      map.set(event.event_id, customerEventService.getTooltipContent(event))
    }
  })
  return map
})

// A billing-route flip can overlap two loads against different backends; only
// the latest may mutate state, so a superseded response is discarded.
let latestLoadToken = 0

const readWorkspaceEvents = (params: { page: number; limit: number }) => {
  const rail = useBillingReadRail()
  return rail === null
    ? workspaceApi.getBillingEvents(params)
    : readOnRail(() => rail.readEvents(params))
}

const loadEvents = async () => {
  const loadToken = ++latestLoadToken
  loading.value = true
  error.value = null

  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit
    }
    const response = shouldUseWorkspaceBilling.value
      ? await readWorkspaceEvents(params)
      : await customerEventService.getMyEvents(params)

    // Completion telemetry must run even when a mid-checkout route flip
    // supersedes this load, since legacy and workspace backends emit different
    // top-up events and the winning fetch may not carry the completion yet.
    if (usePendingTopup().isPendingTopupCompleted(response?.events)) {
      useTelemetry()?.trackApiCreditTopupSucceeded()
    }

    if (loadToken !== latestLoadToken) return

    // Undefined is a SUPERSEDED rail read: the scope moved on mid-request, so
    // what is on screen belongs to the workspace we just left. Only the billing
    // mode is watched, and a switch between two workspaces on the same mode
    // does not remount this table — leaving the rows up would show one
    // workspace's billing events under another.
    if (response === undefined) {
      dropRenderedEvents()
      return
    }

    if (response) {
      if (response.events) {
        events.value = response.events
      }

      if (response.page) {
        pagination.value.page = response.page
      }

      if (response.limit) {
        pagination.value.limit = response.limit
      }

      if (response.total != null) {
        pagination.value.total = response.total
      }

      if (response.totalPages != null) {
        pagination.value.totalPages = response.totalPages
      }
    } else {
      const legacyError = shouldUseWorkspaceBilling.value
        ? null
        : customerEventService.error.value
      error.value = legacyError || t('credits.loadEventsError')
    }
  } catch (err) {
    if (loadToken !== latestLoadToken) return
    error.value = t('credits.loadEventsUnknownError')
    console.error('Error loading events:', err)
  } finally {
    if (loadToken === latestLoadToken) loading.value = false
  }
}

const onPageChange = (event: { page: number }) => {
  pagination.value.page = event.page + 1
  loadEvents().catch((error) => {
    console.error('Error loading events:', error)
  })
}

/**
 * Forget what is on screen. A superseded read and a workspace switch both mean
 * the rendered rows belong to a scope this table has left, so they go before
 * the next read rather than after it settles.
 */
const dropRenderedEvents = () => {
  events.value = []
  pagination.value = { ...pagination.value, page: 1, total: 0, totalPages: 0 }
}

const refresh = async () => {
  pagination.value.page = 1
  await loadEvents()
}

const workspaceStore = useTeamWorkspaceStore()

// The active workspace is watched alongside the billing mode: a switch between
// two workspaces on the same mode leaves this table mounted, and without this
// nothing reloads it at all when no read happens to be in flight.
watch(
  [shouldUseWorkspaceBilling, () => workspaceStore.activeWorkspaceId],
  ([, workspaceId], previous) => {
    if (previous !== undefined && previous[1] !== workspaceId) {
      dropRenderedEvents()
    }
    refresh().catch((error) => {
      console.error('Error loading events:', error)
    })
  },
  { immediate: true }
)

defineExpose({
  refresh
})
</script>
