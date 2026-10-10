import { onTestFinished, vi } from 'vitest'
import { ref } from 'vue'

import {
  hasParamsBeyondDetailsColumn,
  presentTooltipParamKeys
} from '../customerEventParams'
import type * as real from '../customerEventsService'

type CustomerEventsService = ReturnType<typeof real.useCustomerEventsService>

export const EventType = {
  CREDIT_ADDED: 'credit_added',
  ACCOUNT_CREATED: 'account_created',
  API_USAGE_STARTED: 'api_usage_started',
  API_USAGE_COMPLETED: 'api_usage_completed'
} satisfies {
  [K in keyof typeof real.EventType]: `${(typeof real.EventType)[K]}`
}

const eventLabels = new Map<string, string>([
  [EventType.CREDIT_ADDED, 'Credits Added'],
  [EventType.ACCOUNT_CREATED, 'Account Created'],
  [EventType.API_USAGE_COMPLETED, 'API Usage']
])
const eventSeverities = new Map<
  string,
  ReturnType<CustomerEventsService['getEventSeverity']>
>([
  [EventType.CREDIT_ADDED, 'success'],
  [EventType.API_USAGE_COMPLETED, 'warning']
])

const customerEventsService: CustomerEventsService = {
  isLoading: ref(false),
  error: ref(null),
  getMyEvents: vi.fn(async () => ({ events: [] })),
  formatEventType: vi.fn((type) => eventLabels.get(type) ?? type),
  getEventSeverity: vi.fn((type) => eventSeverities.get(type) ?? 'info'),
  formatAmount: vi.fn((amount) => {
    if (!amount) return '0.00'
    return (amount / 100).toFixed(2)
  }),
  hasAdditionalInfo: vi.fn(hasParamsBeyondDetailsColumn),
  formatDate: vi.fn((date) => new Date(date).toLocaleDateString()),
  formatJsonKey: vi.fn((key) => key),
  formatJsonValue: vi.fn((value) => value),
  getTooltipContent: vi.fn((event) => {
    const params = event.params ?? {}
    return presentTooltipParamKeys(params)
      .map((key) => `${key}: ${String(params[key])}`)
      .join('\n')
  })
}

export const useCustomerEventsService = vi.fn<
  typeof real.useCustomerEventsService
>(() => {
  onTestFinished(() => {
    customerEventsService.isLoading.value = false
    customerEventsService.error.value = null
  })
  return customerEventsService
})
