import { onTestFinished, vi } from 'vitest'
import { ref } from 'vue'

import type * as real from '../customerEventsService'

export const { EventType } = await vi.importActual<typeof real>(
  '../customerEventsService'
)

const customerEventsService: ReturnType<typeof real.useCustomerEventsService> =
  {
    isLoading: ref(false),
    error: ref(null),
    getMyEvents: vi.fn(async () => null),
    formatEventType: vi.fn((type) => type),
    getEventSeverity: vi.fn(() => 'info' as const),
    formatAmount: vi.fn(() => '0.00'),
    hasAdditionalInfo: vi.fn(() => false),
    formatDate: vi.fn((date) => date),
    formatJsonKey: vi.fn((key) => key),
    formatJsonValue: vi.fn((value) => value),
    getTooltipContent: vi.fn(() => '')
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
