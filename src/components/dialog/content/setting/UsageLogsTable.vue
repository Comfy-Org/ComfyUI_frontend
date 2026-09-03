<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center p-8">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="p-4">
      <Message severity="error" :closable="false">{{ error }}</Message>
    </div>
    <Table v-else class="rounded-lg border border-border-default">
      <TableHeader>
        <TableRow>
          <TableHead>{{ $t('credits.eventType') }}</TableHead>
          <TableHead>{{ $t('credits.details') }}</TableHead>
          <TableHead>{{ $t('credits.time') }}</TableHead>
          <TableHead>{{ $t('credits.additionalInfo') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="(event, index) in events"
          :key="event.event_id ?? index"
        >
          <TableCell>
            <Badge
              :value="
                customerEventService.formatEventType(event.event_type ?? '')
              "
              variant="badge"
              :severity="
                customerEventService.getEventSeverity(event.event_type ?? '')
              "
            />
          </TableCell>
          <TableCell>
            <div class="event-details">
              <template v-if="event.event_type === EventType.CREDIT_ADDED">
                <div class="font-semibold text-green-500">
                  {{ $t('credits.added') }} ${{
                    customerEventService.formatAmount(getEventAmount(event))
                  }}
                </div>
              </template>

              <template
                v-else-if="event.event_type === EventType.ACCOUNT_CREATED"
              >
                <div>{{ $t('credits.accountInitialized') }}</div>
              </template>

              <template
                v-else-if="event.event_type === EventType.API_USAGE_COMPLETED"
              >
                <div class="flex flex-col gap-1">
                  <div class="font-semibold">
                    {{ event.params?.api_name || 'API' }}
                  </div>
                  <div class="text-sm text-smoke-400">
                    {{ $t('credits.model') }}: {{ event.params?.model || '-' }}
                  </div>
                </div>
              </template>
            </div>
          </TableCell>
          <TableCell>
            {{ customerEventService.formatDate(event.createdAt ?? '') }}
          </TableCell>
          <TableCell>
            <Button
              v-if="customerEventService.hasAdditionalInfo(event)"
              v-tooltip.top="{
                escape: false,
                value: tooltipContentMap.get(event.event_id ?? '') || ''
              }"
              variant="textonly"
              size="icon-sm"
              :aria-label="$t('credits.additionalInfo')"
            >
              <i class="pi pi-info-circle" />
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <Pagination
      v-if="!loading && !error && pagination.totalPages > 1"
      :page="pagination.page"
      :total="pagination.total"
      :items-per-page="pagination.limit"
      class="mt-3 flex justify-center"
      @update:page="onPageChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Message from '@/components/ui/message/Message.vue'
import Pagination from '@/components/ui/pagination/Pagination.vue'
import ProgressSpinner from '@/components/ui/spinner/Spinner.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { useTelemetry } from '@/platform/telemetry'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { usePendingTopup } from '@/composables/billing/usePendingTopup'
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

const tooltipContentMap = computed(() => {
  const map = new Map<string, string>()
  events.value.forEach((event) => {
    if (customerEventService.hasAdditionalInfo(event) && event.event_id) {
      map.set(event.event_id, customerEventService.getTooltipContent(event))
    }
  })
  return map
})

function getEventAmount(event: AuditLog): number | undefined {
  const amount = event.params?.amount
  return typeof amount === 'number' ? amount : undefined
}

// A billing-route flip can overlap two loads against different backends; only
// the latest may mutate state, so a superseded response is discarded.
let latestLoadToken = 0

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
      ? await workspaceApi.getBillingEvents(params)
      : await customerEventService.getMyEvents(params)

    // Completion telemetry must run even when a mid-checkout route flip
    // supersedes this load, since legacy and workspace backends emit different
    // top-up events and the winning fetch may not carry the completion yet.
    if (usePendingTopup().isPendingTopupCompleted(response?.events)) {
      useTelemetry()?.trackApiCreditTopupSucceeded()
    }

    if (loadToken !== latestLoadToken) return

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

const onPageChange = (page: number) => {
  pagination.value.page = page
  loadEvents().catch((error) => {
    console.error('Error loading events:', error)
  })
}

const refresh = async () => {
  pagination.value.page = 1
  await loadEvents()
}

watch(
  shouldUseWorkspaceBilling,
  () => {
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
