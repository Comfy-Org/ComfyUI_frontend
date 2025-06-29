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
      :rows="pagination.limit"
      :total-records="pagination.total"
      :first="dataTableFirst"
      :lazy="true"
      class="p-datatable-sm custom-datatable"
      responsive-layout="scroll"
      @page="onPageChange"
    >
      <Column field="event_type" :header="$t('credits.eventType')">
        <template #body="{ data }">
          <Badge
            :value="formatEventType(data.event_type)"
            :severity="getEventSeverity(data.event_type)"
          />
        </template>
      </Column>
      <Column field="details" :header="$t('credits.details')">
        <template #body="{ data }">
          <div class="event-details">
            <!-- Credits Added -->
            <template v-if="data.event_type === 'credit_added'">
              <div class="text-green-500 font-semibold">
                {{ $t('credits.added') }} ${{
                  formatAmount(data.params?.amount)
                }}
              </div>
            </template>

            <!-- Account Created -->
            <template v-else-if="data.event_type === 'account_created'">
              <div>{{ $t('credits.accountInitialized') }}</div>
            </template>

            <!-- API Usage -->
            <template v-else-if="data.event_type === 'api_usage_completed'">
              <div class="flex flex-col gap-1">
                <div class="font-semibold">
                  {{ data.params?.api_name || 'API' }}
                </div>
                <div class="text-sm text-gray-400">
                  {{ $t('credits.model') }}: {{ data.params?.model || '-' }}
                </div>
              </div>
            </template>
          </div>
        </template>
      </Column>
      <Column field="createdAt" :header="$t('credits.time')">
        <template #body="{ data }">
          {{ formatDate(data.createdAt) }}
        </template>
      </Column>
      <Column field="params" :header="$t('credits.additionalInfo')">
        <template #body="{ data }">
          <Button
            v-if="hasAdditionalInfo(data)"
            v-tooltip.top="{
              escape: false,
              value: getTooltipContent(data),
              pt: {
                text: {
                  style: {
                    width: 'max-content !important'
                  }
                }
              }
            }"
            icon="pi pi-info-circle"
            class="p-button-text p-button-sm"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref } from 'vue'

import { useCustomerService } from '@/services/customerService'
import type { components } from '@/types/comfyRegistryTypes'

const events = ref<components['schemas']['AuditLog'][]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const customerService = useCustomerService()

const pagination = ref({
  page: 1,
  limit: 7,
  total: 0,
  totalPages: 0
})

const dataTableFirst = computed(
  () => (pagination.value.page - 1) * pagination.value.limit
)

const formatEventType = (eventType: string) => {
  switch (eventType) {
    case 'credit_added':
      return 'Credits Added'
    case 'account_created':
      return 'Account Created'
    case 'api_usage_completed':
      return 'API Usage'
    default:
      return eventType
  }
}

const getEventSeverity = (eventType: string) => {
  switch (eventType) {
    case 'credit_added':
      return 'success'
    case 'account_created':
      return 'info'
    case 'api_usage_completed':
      return 'warning'
    default:
      return 'info'
  }
}

const formatAmount = (amountMicros?: number) => {
  if (!amountMicros) return '0.00'
  return (amountMicros / 100).toFixed(2)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const hasAdditionalInfo = (event: components['schemas']['AuditLog']) => {
  const { amount, api_name, model, ...otherParams } = event.params || {}
  return Object.keys(otherParams).length > 0
}

const getTooltipContent = (event: components['schemas']['AuditLog']) => {
  const { amount, api_name, model, ...otherParams } = event.params || {}

  if (Object.keys(otherParams).length === 0) return ''

  return Object.entries(otherParams)
    .map(([key, value]) => {
      const formattedKey = formatJsonKey(key)
      const formattedValue = formatJsonValue(value)
      return `<strong>${formattedKey}:</strong> ${formattedValue}`
    })
    .join('<br>')
}

const loadEvents = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await customerService.getMyEvents({
      page: pagination.value.page,
      limit: pagination.value.limit
    })

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

      if (response.total) {
        pagination.value.total = response.total
      }

      if (response.totalPages) {
        pagination.value.totalPages = response.totalPages
      }
    } else {
      error.value = customerService.error.value || 'Failed to load events'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error loading events:', err)
  } finally {
    loading.value = false
  }
}

const onPageChange = (event: { page: number }) => {
  pagination.value.page = event.page + 1
  void loadEvents()
}

const formatJsonKey = (key: string) => {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatJsonValue = (value: any) => {
  if (typeof value === 'number') {
    // Format numbers with commas and decimals if needed
    return value.toLocaleString()
  }
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    // Format dates nicely
    return new Date(value).toLocaleString()
  }
  return value
}

const refresh = async () => {
  pagination.value.page = 1
  await loadEvents()
}

defineExpose({
  refresh
})
</script>

<style scoped></style>
