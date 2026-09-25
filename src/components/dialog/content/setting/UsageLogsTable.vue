<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center p-8">
      <Spinner />
    </div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">{{ error }}</Message>
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
              variant="badge"
              :severity="
                customerEventService.getEventSeverity(event.event_type ?? '')
              "
            >
              {{ customerEventService.formatEventType(event.event_type ?? '') }}
            </Badge>
          </TableCell>
          <TableCell>
            <UsageLogEventDetails :event />
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
import Spinner from '@/components/ui/spinner/Spinner.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { useTelemetry } from '@/platform/telemetry'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { readOnRail } from '@/platform/workspace/composables/readOnRail'
import { useBillingReadRail } from '@/platform/workspace/composables/useBillingReadRail'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { usePendingTopup } from '@/composables/billing/usePendingTopup'
import type { AuditLog } from '@/services/customerEventsService'
import { useCustomerEventsService } from '@/services/customerEventsService'

import UsageLogEventDetails from './UsageLogEventDetails.vue'

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

const onPageChange = (page: number) => {
  pagination.value.page = page
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
