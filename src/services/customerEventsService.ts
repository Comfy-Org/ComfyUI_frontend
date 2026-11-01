import axios from 'axios'
import { ref } from 'vue'

import { useApiRequest } from '@/composables/useApiRequest'
import { webSessionResourceHeader } from '@comfyorg/api-client/webSessionFetch'
import { attachUnifiedRemintInterceptor } from '@/platform/auth/unified/remintRetry'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import {
  formatCredits,
  isSubCreditCharge,
  microUsdToCredits
} from '@/base/credits/comfyCredits'
import {
  hasParamsBeyondDetailsColumn,
  presentTooltipParamKeys,
  toFiniteNumber
} from '@/services/customerEventParams'
import { d, i18n, t } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import type { components, operations } from '@/types/comfyRegistryTypes'

export enum EventType {
  CREDIT_ADDED = 'credit_added',
  ACCOUNT_CREATED = 'account_created',
  API_USAGE_STARTED = 'api_usage_started',
  API_USAGE_COMPLETED = 'api_usage_completed'
}

type CustomerEventsResponse =
  operations['GetCustomerEvents']['responses']['200']['content']['application/json']

type CustomerEventsResponseQuery =
  operations['GetCustomerEvents']['parameters']['query']

export type AuditLog = components['schemas']['AuditLog']

type ErrorResponse = components['schemas']['ErrorResponse']

const customerApiClient = axios.create({
  headers: {
    'Content-Type': 'application/json'
  }
})

attachUnifiedRemintInterceptor(customerApiClient)

export const useCustomerEventsService = () => {
  const isLoading = ref(false)
  let latestRequestId = 0

  const mapError = (
    err: unknown,
    context: string,
    routeSpecificErrors?: Record<number, string>
  ): string => {
    if (!axios.isAxiosError<Partial<ErrorResponse>>(err)) {
      return `${context} failed: ${err instanceof Error ? err.message : String(err)}`
    }

    if (!err.response) {
      return `${context} failed: ${err.message}`
    }

    const status = err.response.status
    if (routeSpecificErrors?.[status]) {
      return routeSpecificErrors[status]
    }

    return (
      err.response.data.message ?? `${context} failed with status ${status}`
    )
  }

  const { error, executeRequest } = useApiRequest({
    client: customerApiClient,
    mapError
  })

  function formatEventType(eventType: string) {
    switch (eventType) {
      case 'credit_added':
      case 'topup_completed':
        return t('credits.eventTypes.creditAdded')
      case 'account_created':
        return t('credits.eventTypes.accountCreated')
      case 'api_usage_completed':
        return t('credits.eventTypes.apiUsage')
      case 'gpu_usage':
        return t('credits.eventTypes.gpuUsage')
      case 'api_node_usage':
        return t('credits.eventTypes.apiNodeUsage')
      case 'agent_usage':
        return t('credits.eventTypes.agentUsage')
      default:
        return eventType
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)

    return d(date, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function formatJsonKey(key: string) {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  function formatJsonValue(value: unknown) {
    if (typeof value === 'number') {
      return value.toLocaleString()
    }
    if (typeof value === 'string') {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return d(date, { dateStyle: 'medium', timeStyle: 'short' })
      }
    }
    return value
  }

  function getEventSeverity(eventType: string) {
    switch (eventType) {
      case 'credit_added':
      case 'topup_completed':
        return 'success'
      case 'account_created':
        return 'info'
      case 'api_usage_completed':
      case 'gpu_usage':
      case 'api_node_usage':
      case 'agent_usage':
        return 'warning'
      default:
        return 'info'
    }
  }

  function formatChargeCredits(microUsd: number) {
    const credits = microUsdToCredits(microUsd)
    const amount = isSubCreditCharge(credits)
      ? t('credits.lessThanOne')
      : formatCredits({
          value: credits,
          locale: i18n.global.locale.value,
          numberOptions: { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        })
    return `${amount} ${t('credits.credits')}`
  }

  function formatTooltipParam(key: string, value: unknown) {
    const microUsd =
      key === 'charge_micro_usd' ? toFiniteNumber(value) : undefined
    if (microUsd !== undefined) {
      return `${t('credits.charge')}: ${formatChargeCredits(microUsd)}`
    }
    return `${formatJsonKey(key)}: ${formatJsonValue(value)}`
  }

  function getTooltipContent(event: AuditLog) {
    const params = event.params || {}

    return presentTooltipParamKeys(params)
      .map((key) => formatTooltipParam(key, params[key]))
      .join('\n')
  }

  function formatAmount(amountMicros?: number) {
    if (!amountMicros) return '0.00'
    return (amountMicros / 100).toFixed(2)
  }

  async function getMyEvents({
    page = 1,
    limit = 10
  }: CustomerEventsResponseQuery = {}): Promise<CustomerEventsResponse | null> {
    const errorContext = 'Fetching customer events'
    const routeSpecificErrors = {
      400: 'Invalid input, object invalid',
      404: 'Not found'
    }

    const authStore = useAuthStore()
    const requestOwner = authStore.currentUserIdentity()
    const requestId = ++latestRequestId
    if (!authStore.hasPersonalWorkspace) {
      isLoading.value = false
      error.value = t('toastMessages.noPersonalWorkspace')
      return null
    }
    isLoading.value = true
    error.value = null

    let authHeaders
    try {
      authHeaders =
        (await webSessionResourceHeader()) ??
        (await authStore.getUserAuthHeader())
    } catch (err) {
      if (requestId !== latestRequestId) return null
      isLoading.value = false
      error.value = mapError(err, errorContext)
      return null
    }
    if (requestId !== latestRequestId) {
      return null
    }
    if (authStore.currentUserIdentity() !== requestOwner) {
      isLoading.value = false
      return null
    }
    if (!authHeaders) {
      isLoading.value = false
      error.value = 'Authentication header is missing'
      return null
    }

    const result = await executeRequest<CustomerEventsResponse>(
      (client) =>
        client.get('/customers/events', {
          baseURL: getComfyApiBaseUrl(),
          params: { page, limit },
          headers: authHeaders
        }),
      {
        errorContext,
        routeSpecificErrors,
        isCurrent: () =>
          requestId === latestRequestId &&
          authStore.currentUserIdentity() === requestOwner
      }
    )

    if (requestId !== latestRequestId) {
      return null
    }
    isLoading.value = false
    if (authStore.currentUserIdentity() !== requestOwner) {
      return null
    }
    return result
  }

  return {
    isLoading,
    error,

    getMyEvents,
    formatEventType,
    getEventSeverity,
    formatAmount,
    hasAdditionalInfo: hasParamsBeyondDetailsColumn,
    formatDate,
    formatJsonKey,
    formatJsonValue,
    getTooltipContent
  }
}
