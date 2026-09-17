<template>
  <div class="event-details">
    <template v-if="event.event_type === EventType.CREDIT_ADDED">
      <div class="font-semibold text-green-500">
        {{ $t('credits.added') }} ${{
          customerEventService.formatAmount(eventAmount)
        }}
      </div>
    </template>

    <template v-else-if="event.event_type === EventType.ACCOUNT_CREATED">
      <div>{{ $t('credits.accountInitialized') }}</div>
    </template>

    <template v-else-if="event.event_type === EventType.API_USAGE_COMPLETED">
      <div class="flex flex-col gap-1">
        <div class="font-semibold">{{ event.params?.api_name || 'API' }}</div>
        <div class="text-sm text-smoke-400">
          {{ $t('credits.model') }}: {{ event.params?.model || '-' }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { AuditLog } from '@/services/customerEventsService'
import {
  EventType,
  useCustomerEventsService
} from '@/services/customerEventsService'

const { event } = defineProps<{ event: AuditLog }>()

const customerEventService = useCustomerEventsService()
const eventAmount = computed(() => {
  const amount = event.params?.amount
  return typeof amount === 'number' ? amount : undefined
})
</script>
