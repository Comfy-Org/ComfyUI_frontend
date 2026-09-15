<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center p-8">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="p-4">
      <Message severity="error" :closable="false">{{ error }}</Message>
    </div>
    <DataTable
      v-else
      :value="events"
      :paginator="true"
      :rows="limit"
      :total-records="total"
      :first="first"
      :lazy="true"
      class="p-datatable-sm custom-datatable"
      @page="onPageChange"
    >
      <Column field="event_type" :header="$t('credits.eventType')">
        <template #body="{ data }">
          <Badge
            :value="customerEventService.formatEventType(data.event_type)"
            :severity="customerEventService.getEventSeverity(data.event_type)"
          />
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
import Badge from 'primevue/badge'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { usePendingTopup } from '@/composables/billing/usePendingTopup'
import {
  usePaginatedQuery,
  PageRequestError
} from '@/composables/usePaginatedQuery'
import { useTelemetry } from '@/platform/telemetry'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { AuditLog } from '@/services/customerEventsService'
import {
  EventType,
  useCustomerEventsService
} from '@/services/customerEventsService'

const { t } = useI18n()

const customerEventService = useCustomerEventsService()

const { shouldUseWorkspaceBilling } = useBillingRouting()

const {
  items: events,
  limit,
  total,
  first,
  loading,
  error,
  goToPage,
  refresh
} = usePaginatedQuery<AuditLog, boolean>({
  key: shouldUseWorkspaceBilling,
  initialLimit: 7,
  fetchPage: async ({ page, limit: requestedLimit }) => {
    const params = { page, limit: requestedLimit }

    let response
    try {
      response = shouldUseWorkspaceBilling.value
        ? await workspaceApi.getBillingEvents(params)
        : await customerEventService.getMyEvents(params)
    } catch (err) {
      console.error('Error loading events:', err)
      throw new PageRequestError(t('credits.loadEventsUnknownError'), {
        cause: err
      })
    }

    // Completion telemetry must run even when a mid-checkout route flip
    // supersedes this load, since legacy and workspace backends emit
    // different top-up events and the winning fetch may not carry the
    // completion yet.
    if (usePendingTopup().isPendingTopupCompleted(response?.events)) {
      useTelemetry()?.trackApiCreditTopupSucceeded()
    }

    if (!response) {
      const legacyError = shouldUseWorkspaceBilling.value
        ? null
        : customerEventService.error.value
      throw new PageRequestError(legacyError || t('credits.loadEventsError'))
    }

    return {
      items: response.events ?? [],
      page: response.page ?? page,
      limit: response.limit ?? requestedLimit,
      total: response.total ?? 0
    }
  }
})

const tooltipContentMap = computed(() => {
  const map = new Map<string, string>()
  events.value.forEach((event) => {
    if (customerEventService.hasAdditionalInfo(event) && event.event_id) {
      map.set(event.event_id, customerEventService.getTooltipContent(event))
    }
  })
  return map
})

const onPageChange = (event: { page: number }) => {
  goToPage(event.page + 1)
}

defineExpose({
  refresh
})
</script>
