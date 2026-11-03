import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  EventType,
  useCustomerEventsService
} from '@/services/customerEventsService'

const mockI18n = vi.hoisted(() => ({
  d: vi.fn()
}))

vi.mock(import('@/i18n'), async () => {
  const { createI18n } = await import('vue-i18n')
  return {
    d: mockI18n.d,
    t: (key: string) => key,
    i18n: createI18n({ legacy: false, locale: 'en' })
  }
})

describe('useCustomerEventsService', () => {
  let service: ReturnType<typeof useCustomerEventsService>

  beforeEach(() => {
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

  describe('formatEventType', () => {
    const expectedByType: Record<string, string> = {
      credit_added: 'credits.eventTypes.creditAdded',
      topup_completed: 'credits.eventTypes.creditAdded',
      account_created: 'credits.eventTypes.accountCreated',
      api_usage_completed: 'credits.eventTypes.apiUsage',
      gpu_usage: 'credits.eventTypes.gpuUsage',
      api_node_usage: 'credits.eventTypes.apiNodeUsage',
      agent_usage: 'credits.eventTypes.agentUsage'
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
      expect(service.getEventSeverity('agent_usage')).toBe('warning')
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

  type Params = Record<string, unknown> | undefined
  type ParamsCase = [label: string, params: Params, eventType?: string]

  const makeEvent = (params: Params, eventType = 'api_node_usage') => ({
    event_id: 'test',
    event_type: eventType,
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
      ['duration', { duration: 1000 }],
      ['credits_used', { credits_used: 7 }],
      ['endpoint', { endpoint: '/v1/images' }],
      ['subscription_id', { subscription_id: 'sub-1' }],
      ['gpu_seconds', { gpu_seconds: 3 }],
      [
        'api_name and model on a type whose details column omits them',
        { api_name: 'test-api', model: 'test-model', ...unrenderableParams }
      ],
      [
        'amount on a type whose details column omits it',
        { amount: 1000 },
        'topup_completed'
      ]
    ]

    it.for(withAdditionalInfo)(
      'should return true when event has %s',
      ([, params, eventType]) => {
        expect(service.hasAdditionalInfo(makeEvent(params, eventType))).toBe(
          true
        )
      }
    )

    const withoutAdditionalInfo: ParamsCase[] = [
      [
        'only the api usage keys its details column shows',
        { api_name: 'test-api', model: 'test-model' },
        EventType.API_USAGE_COMPLETED
      ],
      [
        'only the amount its details column shows',
        { amount: 1000 },
        EventType.CREDIT_ADDED
      ],
      ['only params outside the allowlist', unrenderableParams],
      [
        'only null or empty allowlisted values',
        { duration: null, endpoint: '' }
      ],
      ['no params', {}],
      ['undefined params', undefined]
    ]

    it.for(withoutAdditionalInfo)(
      'should return false when event has %s',
      ([, params, eventType]) => {
        expect(service.hasAdditionalInfo(makeEvent(params, eventType))).toBe(
          false
        )
      }
    )
  })

  describe('getTooltipContent', () => {
    it('should render every allowlisted parameter in allowlist order', () => {
      const result = service.getTooltipContent(
        makeEvent({
          duration: 5000,
          gpu_seconds: 3,
          subscription_id: 'sub-1',
          endpoint: '/v1/images',
          api_name: 'test-api',
          model: 'test-model',
          amount: 1000,
          credits_used: 12
        })
      )

      expect(result).toBe(
        [
          'Credits Used: 12',
          'Amount: 1,000',
          'Model: test-model',
          'Api Name: test-api',
          'Endpoint: /v1/images',
          'Subscription Id: sub-1',
          'Gpu Seconds: 3',
          'Duration: 5,000'
        ].join('\n')
      )
    })

    it('should never render provider cost params or prompts', () => {
      const result = service.getTooltipContent(
        makeEvent({ duration: 5000, ...unrenderableParams })
      )

      expect(result).toBe('Duration: 5,000')
    })

    it.for([
      { charge: 33_044, expected: 'credits.charge: 7 credits.credits' },
      { charge: '36209', expected: 'credits.charge: 8 credits.credits' },
      {
        charge: 10_000_000_000,
        expected: 'credits.charge: 2,110,000 credits.credits'
      },
      { charge: 0, expected: 'credits.charge: 0 credits.credits' },
      {
        charge: 1,
        expected: 'credits.charge: credits.lessThanOne credits.credits'
      },
      {
        charge: 1_000,
        expected: 'credits.charge: credits.lessThanOne credits.credits'
      },
      {
        charge: 3_318,
        expected: 'credits.charge: credits.lessThanOne credits.credits'
      },
      { charge: 4_740, expected: 'credits.charge: 1 credits.credits' },
      { charge: 6_636, expected: 'credits.charge: 1 credits.credits' },
      { charge: 'n/a', expected: 'Charge Micro Usd: n/a' }
    ])(
      'should render charge_micro_usd $charge as $expected',
      ({ charge, expected }) => {
        expect(
          service.getTooltipContent(makeEvent({ charge_micro_usd: charge }))
        ).toBe(expected)
      }
    )

    const withNothingToRender: ParamsCase[] = [
      ['params carry only non-allowlisted keys', unrenderableParams],
      [
        'allowlisted values are null or empty',
        { duration: null, endpoint: '' }
      ],
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
