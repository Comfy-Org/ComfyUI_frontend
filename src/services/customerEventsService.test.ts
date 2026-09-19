import { useAuthStore } from '@/stores/authStore'
import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock(import('firebase/auth'))

import {
  EventType,
  useCustomerEventsService
} from '@/services/customerEventsService'
import type { AuthHeader } from '@/types/authTypes'

// Hoist the mocks to avoid hoisting issues
const mockAxiosInstance = vi.hoisted(() => ({
  get: vi.fn(),
  interceptors: { response: { use: vi.fn() } }
}))

const mockI18n = vi.hoisted(() => ({
  d: vi.fn()
}))

// Mock dependencies
vi.mock<unknown>(import('axios'), () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
    isAxiosError: vi.fn()
  }
}))

vi.mock(import('@/i18n'), () => ({
  d: mockI18n.d,
  t: (key: string) => key
}))

vi.mock<unknown>(import('@/utils/typeGuardUtil'), () => ({
  isAbortError: vi.fn()
}))

describe('useCustomerEventsService', () => {
  let service: ReturnType<typeof useCustomerEventsService>

  const mockAuthHeaders = {
    Authorization: 'Bearer mock-token'
  } satisfies AuthHeader

  const mockEventsResponse = {
    events: [
      {
        event_id: 'event-1',
        event_type: 'credit_added',
        params: {
          amount: 1000,
          transaction_id: 'txn-123',
          payment_method: 'stripe'
        },
        createdAt: '2024-01-01T10:00:00Z'
      },
      {
        event_id: 'event-2',
        event_type: 'api_usage_completed',
        params: {
          api_name: 'Image Generation',
          model: 'sdxl-base',
          duration: 5000,
          cost: 50
        },
        createdAt: '2024-01-02T10:00:00Z'
      }
    ],
    total: 2,
    page: 1,
    limit: 10,
    totalPages: 1
  }

  beforeEach(() => {
    vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValue(
      mockAuthHeaders
    )
    vi.mocked(useAuthStore().currentUserIdentity).mockReturnValue('api-key-a')
    mockI18n.d.mockImplementation((date, options) => {
      // Mock i18n date formatting
      if (options?.month === 'short') {
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
      return date.toLocaleString()
    })

    service = useCustomerEventsService()
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      expect(service.isLoading.value).toBe(false)
      expect(service.error.value).toBeNull()
    })

    it('should initialize i18n date formatter', () => {
      expect(mockI18n.d).toBeDefined()
    })
  })

  describe('getMyEvents', () => {
    it('should fetch events successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockEventsResponse })

      const result = await service.getMyEvents({
        page: 1,
        limit: 10
      })

      expect(useAuthStore().getUserAuthHeader).toHaveBeenCalled()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/customers/events', {
        params: { page: 1, limit: 10 },
        headers: mockAuthHeaders
      })

      expect(result).toEqual(mockEventsResponse)
      expect(service.isLoading.value).toBe(false)
      expect(service.error.value).toBeNull()
    })

    it('should use default parameters when none provided', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockEventsResponse })

      await service.getMyEvents()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/customers/events', {
        params: { page: 1, limit: 10 },
        headers: mockAuthHeaders
      })
    })

    it('should return null when auth headers are missing', async () => {
      vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValue(null)

      const result = await service.getMyEvents()

      expect(result).toBeNull()
      expect(service.error.value).toBe('Authentication header is missing')
      expect(mockAxiosInstance.get).not.toHaveBeenCalled()
    })

    it('discards events that resolve after an A->B API key switch', async () => {
      let resolveEvents!: (value: unknown) => void
      const eventsRequestStarted = new Promise<void>((requestStarted) => {
        mockAxiosInstance.get.mockImplementation(() => {
          requestStarted()
          return new Promise((resolve) => {
            resolveEvents = resolve
          })
        })
      })

      const request = service.getMyEvents()
      await eventsRequestStarted
      vi.mocked(useAuthStore().currentUserIdentity).mockReturnValue('api-key-b')
      resolveEvents({ data: mockEventsResponse })

      await expect(request).resolves.toBeNull()
    })

    it('never exposes a stale error after an A->B API key switch', async () => {
      let rejectEvents!: (reason: unknown) => void
      const eventsRequestStarted = new Promise<void>((requestStarted) => {
        mockAxiosInstance.get.mockImplementation(() => {
          requestStarted()
          return new Promise((_resolve, reject) => {
            rejectEvents = reject
          })
        })
      })
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      const request = service.getMyEvents()
      await eventsRequestStarted
      vi.mocked(useAuthStore().currentUserIdentity).mockReturnValue('api-key-b')
      rejectEvents({
        response: { status: 400, data: { message: 'account A backend error' } }
      })

      await expect(request).resolves.toBeNull()
      expect(service.error.value).toBeNull()
      expect(service.isLoading.value).toBe(false)
    })

    it('ignores a stale auth preflight once a newer request begins', async () => {
      let resolveStaleHeader!: (
        value: Awaited<
          ReturnType<ReturnType<typeof useAuthStore>['getUserAuthHeader']>
        >
      ) => void
      vi.mocked(useAuthStore().getUserAuthHeader).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStaleHeader = resolve
          })
      )
      const staleRequest = service.getMyEvents()

      vi.mocked(useAuthStore().currentUserIdentity).mockReturnValue('api-key-b')
      const activeRequestStarted = new Promise<void>((requestStarted) => {
        mockAxiosInstance.get.mockImplementation(() => {
          requestStarted()
          return new Promise(() => {})
        })
      })
      const activeRequest = service.getMyEvents()
      await activeRequestStarted

      resolveStaleHeader(null)
      await expect(staleRequest).resolves.toBeNull()

      expect(service.error.value).toBeNull()
      expect(service.isLoading.value).toBe(true)
      void activeRequest
    })

    it('should handle 400 errors', async () => {
      const errorResponse = {
        response: {
          status: 400,
          data: { message: 'Invalid input' }
        }
      }
      mockAxiosInstance.get.mockRejectedValue(errorResponse)
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      const result = await service.getMyEvents()

      expect(result).toBeNull()
      expect(service.error.value).toBe('Invalid input, object invalid')
    })

    it('should handle 404 errors', async () => {
      const errorResponse = {
        response: {
          status: 404,
          data: { message: 'Not found' }
        }
      }
      mockAxiosInstance.get.mockRejectedValue(errorResponse)
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      const result = await service.getMyEvents()

      expect(result).toBeNull()
      expect(service.error.value).toBe('Not found')
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error')
      mockAxiosInstance.get.mockRejectedValue(networkError)
      vi.mocked(axios.isAxiosError).mockReturnValue(false)

      const result = await service.getMyEvents()

      expect(result).toBeNull()
      expect(service.error.value).toBe(
        'Fetching customer events failed: Network Error'
      )
    })
  })

  describe('formatEventType', () => {
    const expectedByType: Record<string, string> = {
      credit_added: 'credits.eventTypes.creditAdded',
      topup_completed: 'credits.eventTypes.creditAdded',
      account_created: 'credits.eventTypes.accountCreated',
      api_usage_completed: 'credits.eventTypes.apiUsage',
      gpu_usage: 'credits.eventTypes.gpuUsage',
      api_node_usage: 'credits.eventTypes.apiNodeUsage'
    }

    it('maps known legacy and unified event types to expected i18n keys', () => {
      for (const [eventType, expectedKey] of Object.entries(expectedByType)) {
        expect(service.formatEventType(eventType)).toBe(expectedKey)
      }
    })

    it('should return the original string for unknown event types', () => {
      expect(service.formatEventType('unknown_event')).toBe('unknown_event')
    })
  })

  describe('getEventSeverity', () => {
    it('should return correct severity for known event types', () => {
      expect(service.getEventSeverity(EventType.CREDIT_ADDED)).toBe('success')
      expect(service.getEventSeverity(EventType.ACCOUNT_CREATED)).toBe('info')
      expect(service.getEventSeverity(EventType.API_USAGE_COMPLETED)).toBe(
        'warning'
      )
    })

    it('returns success for the unified topup_completed event', () => {
      expect(service.getEventSeverity('topup_completed')).toBe('success')
    })

    it('returns warning for unified usage events', () => {
      expect(service.getEventSeverity('gpu_usage')).toBe('warning')
      expect(service.getEventSeverity('api_node_usage')).toBe('warning')
    })

    it('should return default severity for unknown event types', () => {
      expect(service.getEventSeverity('unknown_event')).toBe('info')
    })
  })

  describe('formatAmount', () => {
    it('should format amounts correctly', () => {
      expect(service.formatAmount(1000)).toBe('10.00')
      expect(service.formatAmount(2550)).toBe('25.50')
      expect(service.formatAmount(100)).toBe('1.00')
    })

    it('should handle undefined amounts', () => {
      expect(service.formatAmount(undefined)).toBe('0.00')
      expect(service.formatAmount(0)).toBe('0.00')
    })
  })

  describe('formatDate', () => {
    it('should use i18n date formatter', () => {
      const dateString = '2024-01-01T10:00:00Z'

      service.formatDate(dateString)

      expect(mockI18n.d).toHaveBeenCalledWith(new Date(dateString), {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    })

    it('should return formatted date string', () => {
      const dateString = '2024-01-01T10:00:00Z'
      const result = service.formatDate(dateString)

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  type ParamsCase = [label: string, params: Record<string, unknown> | undefined]

  const makeEvent = (params: Record<string, unknown> | undefined) => ({
    event_id: 'test',
    event_type: 'api_node_usage',
    params,
    createdAt: '2024-01-01T10:00:00Z'
  })

  const unrenderableParams = {
    prompt: 'a private prompt from another workspace member',
    credits: 500000000,
    final_unit_deduction: 12345
  }

  describe('hasAdditionalInfo', () => {
    const withAdditionalInfo: ParamsCase[] = [
      ['an allowlisted key outside the details column', { duration: 1000 }],
      ['credits_used', { credits_used: 7 }],
      ['endpoint', { endpoint: '/v1/images' }],
      ['subscription_id', { subscription_id: 'sub-1' }],
      ['gpu_seconds', { gpu_seconds: 3 }]
    ]

    it.for(withAdditionalInfo)(
      'should return true when event has %s',
      ([, params]) => {
        expect(service.hasAdditionalInfo(makeEvent(params))).toBe(true)
      }
    )

    const withoutAdditionalInfo: ParamsCase[] = [
      [
        'only keys already shown in the details column',
        { amount: 1000, api_name: 'test-api', model: 'test-model' }
      ],
      ['only params outside the allowlist', unrenderableParams],
      [
        'allowlisted details-column keys alongside excluded params',
        { api_name: 'test-api', model: 'test-model', ...unrenderableParams }
      ],
      ['no params', {}],
      ['undefined params', undefined]
    ]

    it.for(withoutAdditionalInfo)(
      'should return false when event has %s',
      ([, params]) => {
        expect(service.hasAdditionalInfo(makeEvent(params))).toBe(false)
      }
    )
  })

  describe('getTooltipContent', () => {
    it('should render every allowlisted parameter', () => {
      const result = service.getTooltipContent(
        makeEvent({
          credits_used: 12,
          amount: 1000,
          model: 'test-model',
          api_name: 'test-api',
          endpoint: '/v1/images',
          subscription_id: 'sub-1',
          gpu_seconds: 3,
          duration: 5000
        })
      )

      expect(result).toContain('<strong>Credits Used:</strong> 12')
      expect(result).toContain('<strong>Amount:</strong> 1,000')
      expect(result).toContain('<strong>Model:</strong> test-model')
      expect(result).toContain('<strong>Api Name:</strong> test-api')
      expect(result).toContain('<strong>Endpoint:</strong> /v1/images')
      expect(result).toContain('<strong>Subscription Id:</strong> sub-1')
      expect(result).toContain('<strong>Gpu Seconds:</strong> 3')
      expect(result).toContain('<strong>Duration:</strong> 5,000')
      expect(result).toContain('<br>')
    })

    it('should never render provider cost params or prompts', () => {
      const result = service.getTooltipContent(
        makeEvent({ duration: 5000, ...unrenderableParams })
      )

      expect(result).toBe('<strong>Duration:</strong> 5,000')
      expect(result).not.toContain('prompt')
      expect(result).not.toContain('private')
      expect(result).not.toContain('500,000,000')
      expect(result).not.toContain('500000000')
      expect(result).not.toContain('Final Unit Deduction')
      expect(result).not.toContain('12,345')
    })

    const withNothingToRender: ParamsCase[] = [
      ['params carry only non-allowlisted keys', unrenderableParams],
      ['there are no params', {}],
      ['params are undefined', undefined]
    ]

    it.for(withNothingToRender)(
      'should return empty string when %s',
      ([, params]) => {
        expect(service.getTooltipContent(makeEvent(params))).toBe('')
      }
    )
  })

  describe('formatJsonKey', () => {
    it('should format keys correctly', () => {
      expect(service.formatJsonKey('transaction_id')).toBe('Transaction Id')
      expect(service.formatJsonKey('api_name')).toBe('Api Name')
      expect(service.formatJsonKey('simple')).toBe('Simple')
    })
  })

  describe('formatJsonValue', () => {
    it('should format numbers with commas', () => {
      expect(service.formatJsonValue(1000)).toBe('1,000')
      expect(service.formatJsonValue(1234567)).toBe('1,234,567')
    })

    it('should format date strings', () => {
      const dateString = '2024-01-01T10:00:00Z'
      const result = service.formatJsonValue(dateString)
      expect(typeof result).toBe('string')
      expect(result).not.toBe(dateString) // Should be formatted
    })
  })

  describe('error handling edge cases', () => {
    it('should handle non-Error objects', async () => {
      const stringError = 'String error'
      mockAxiosInstance.get.mockRejectedValue(stringError)
      vi.mocked(axios.isAxiosError).mockReturnValue(false)

      const result = await service.getMyEvents()

      expect(result).toBeNull()
      expect(service.error.value).toBe(
        'Fetching customer events failed: String error'
      )
    })

    it('should reset error state on new request', async () => {
      // First request fails
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('First error'))
      await service.getMyEvents()
      expect(service.error.value).toBeTruthy()

      // Second request succeeds
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockEventsResponse })
      await service.getMyEvents()
      expect(service.error.value).toBeNull()
    })
  })

  describe('EventType enum', () => {
    it('should have correct enum values', () => {
      expect(EventType.CREDIT_ADDED).toBe('credit_added')
      expect(EventType.ACCOUNT_CREATED).toBe('account_created')
      expect(EventType.API_USAGE_STARTED).toBe('api_usage_started')
      expect(EventType.API_USAGE_COMPLETED).toBe('api_usage_completed')
    })
  })

  describe('edge cases for formatting functions', () => {
    it('formatJsonKey should handle empty strings', () => {
      expect(service.formatJsonKey('')).toBe('')
    })

    it('formatJsonKey should handle single words', () => {
      expect(service.formatJsonKey('test')).toBe('Test')
    })

    it('formatAmount should handle very large numbers', () => {
      expect(service.formatAmount(999999999)).toBe('9999999.99')
    })
  })
})
