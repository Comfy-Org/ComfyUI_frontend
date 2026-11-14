<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center p-8">
      <AppSpinner />
    </div>
    <div v-else-if="error" class="p-4">
      <Message severity="error">{{ error }}</Message>
    </div>
    <template v-else>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ $t('credits.eventType') }}</TableHead>
            <TableHead>{{ $t('credits.details') }}</TableHead>
            <TableHead>{{ $t('credits.time') }}</TableHead>
            <TableHead v-if="showMemberColumn">{{
              $t('credits.member')
            }}</TableHead>
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
                {{
                  customerEventService.formatEventType(event.event_type ?? '')
                }}
              </Badge>
            </TableCell>
            <TableCell>
              <div
                v-if="event.event_type === EventType.CREDIT_ADDED"
                class="font-semibold text-success"
              >
                {{ $t('credits.added') }} ${{
                  customerEventService.formatAmount(eventAmount(event))
                }}
              </div>
              <div v-else-if="event.event_type === EventType.ACCOUNT_CREATED">
                {{ $t('credits.accountInitialized') }}
              </div>
              <div
                v-else-if="event.event_type === EventType.API_USAGE_COMPLETED"
                class="flex flex-col gap-1"
              >
                <div class="font-semibold">
                  {{ event.params?.api_name || $t('credits.api') }}
                </div>
                <div class="text-muted-foreground">
                  {{ $t('credits.model') }}: {{ event.params?.model || '-' }}
                </div>
              </div>
            </TableCell>
            <TableCell>
              {{ customerEventService.formatDate(event.createdAt ?? '') }}
            </TableCell>
            <TableCell v-if="showMemberColumn">
              {{ memberLabel(event) }}
            </TableCell>
            <TableCell>
              <Button
                v-if="customerEventService.hasAdditionalInfo(event)"
                :tooltip="customerEventService.getTooltipContent(event)"
                variant="textonly"
                size="icon-sm"
                :aria-label="$t('credits.additionalInfo')"
              >
                <i class="icon-[lucide--info]" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <AppPagination
        v-if="pagination.total > pagination.limit"
        :page="pagination.page"
        :total="pagination.total"
        :items-per-page="pagination.limit"
        class="mt-3"
        @update:page="onPageChange"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Badge from '@comfyorg/design-system/badge/Badge'
import Message from '@comfyorg/design-system/message/Message'
import AppPagination from '@/components/common/AppPagination.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'
import Table from '@comfyorg/design-system/table/Table'
import TableBody from '@comfyorg/design-system/table/TableBody'
import TableCell from '@comfyorg/design-system/table/TableCell'
import TableHead from '@comfyorg/design-system/table/TableHead'
import TableHeader from '@comfyorg/design-system/table/TableHeader'
import TableRow from '@comfyorg/design-system/table/TableRow'
import { useBillingRouting } from '@/platform/billing/composables/useBillingRouting'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTelemetry } from '@comfyorg/telemetry'
import { readWorkspaceBillingEvents } from '@/platform/billing/composables/readWorkspaceBillingEvents'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'
import { usePendingTopup } from '@/platform/billing/composables/usePendingTopup'
import { toFiniteNumber } from '@/platform/billing/api/customerEventParams'
import type { AuditLog } from '@/platform/billing/api/customerEventsService'
import {
  EventType,
  useCustomerEventsService
} from '@/platform/billing/api/customerEventsService'

const { t } = useI18n()
const { flags } = useFeatureFlags()

type BillingEvent = NonNullable<
  Awaited<ReturnType<typeof readWorkspaceBillingEvents>>
>['events'][number]
type ActivityEvent = AuditLog &
  Pick<BillingEvent, 'member_display_name' | 'member_email' | 'member_former'>

const events = ref<ActivityEvent[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const customerEventService = useCustomerEventsService()

const { shouldUseWorkspaceBilling } = useBillingRouting()
const routingPending = computed(() => !shouldUseWorkspaceBilling.value)

const pagination = ref({
  page: 1,
  limit: 7,
  total: 0
})

const showMemberColumn = computed(
  () =>
    flags.billingNewUxEnabled &&
    events.value.some((e) => e.member_display_name || e.member_email)
)

function memberLabel(event: ActivityEvent) {
  const name = event.member_display_name || event.member_email
  if (!name) return '-'
  return event.member_former ? t('credits.formerMember', { name }) : name
}

function eventAmount(event: AuditLog) {
  return toFiniteNumber(event.params?.amount)
}

// A billing-route flip can overlap two loads against different backends; only
// the latest may mutate state, so a superseded response is discarded.
let latestLoadToken = 0

const loadEvents = async () => {
  const loadToken = ++latestLoadToken
  if (routingPending.value) {
    dropRenderedEvents()
    error.value = workspaceInitSettled.value
      ? t('credits.loadEventsError')
      : null
    loading.value = !workspaceInitSettled.value
    return
  }
  loading.value = true
  error.value = null

  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit
    }
    const response = await readWorkspaceBillingEvents(params)

    // Completion telemetry must run even when a mid-checkout route flip
    // supersedes this load.
    const completedTopup = usePendingTopup().consumeCompletedTopup(
      response?.events
    )
    if (completedTopup) {
      const telemetry = useTelemetry()
      telemetry?.trackApiCreditTopupSucceeded()
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'succeeded',
        outcome: 'success',
        duration_ms: Date.now() - completedTopup.startedAtMs
      })
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
    } else {
      error.value = t('credits.loadEventsError')
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
  pagination.value = { ...pagination.value, page: 1, total: 0 }
}

const refresh = async () => {
  pagination.value.page = 1
  await loadEvents()
}

const workspaceStore = useWorkspaceIdentity()
const workspaceInitSettled = computed(() => workspaceStore.initSettled)

// The active workspace is watched alongside the billing mode: a switch between
// two workspaces on the same mode leaves this table mounted, and without this
// nothing reloads it at all when no read happens to be in flight.
watch(
  [
    shouldUseWorkspaceBilling,
    () => workspaceStore.activeWorkspaceId,
    workspaceInitSettled
  ],
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
