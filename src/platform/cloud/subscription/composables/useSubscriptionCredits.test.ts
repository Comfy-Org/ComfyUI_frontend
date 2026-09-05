import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import * as comfyCredits from '@/base/credits/comfyCredits'
import { useSubscriptionCredits } from '@/platform/cloud/subscription/composables/useSubscriptionCredits'

let mockBillingBalance: {
  amountMicros: number
  cloudCreditBalanceMicros?: number
  prepaidBalanceMicros?: number
} | null = null
let mockBillingIsLoading = false

const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  messages: {
    'en-US': {},
    'de-DE': {}
  }
})

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    balance: computed(() => mockBillingBalance),
    isLoading: computed(() => mockBillingIsLoading)
  })
}))

function mountComposable(): ReturnType<typeof useSubscriptionCredits> {
  let composable!: ReturnType<typeof useSubscriptionCredits>
  render(
    {
      setup() {
        composable = useSubscriptionCredits()
        return () => null
      }
    },
    { global: { plugins: [i18n] } }
  )
  return composable
}

describe('useSubscriptionCredits', () => {
  beforeEach(() => {
    mockBillingBalance = null
    mockBillingIsLoading = false
    i18n.global.locale.value = 'en-US'
  })

  describe('totalCredits', () => {
    it('should return "0" when balance is null', () => {
      mockBillingBalance = null
      const { totalCredits } = mountComposable()
      expect(totalCredits.value).toBe('0')
    })

    it('should reactively format amountMicros for the active locale', () => {
      mockBillingBalance = { amountMicros: 100_000 }
      const { totalCredits } = mountComposable()
      expect(totalCredits.value).toBe('211,000')

      i18n.global.locale.value = 'de-DE'
      expect(totalCredits.value).toBe('211.000')
    })

    it('should handle formatting errors by throwing', () => {
      const formatSpy = vi.spyOn(comfyCredits, 'formatCreditsFromCents')
      formatSpy.mockImplementationOnce(() => {
        throw new Error('Formatting error')
      })

      mockBillingBalance = { amountMicros: 100 }
      const { totalCredits } = mountComposable()
      expect(() => totalCredits.value).toThrow('Formatting error')
      formatSpy.mockRestore()
    })
  })

  describe('monthlyBonusCredits', () => {
    it('should return "0" when cloudCreditBalanceMicros is missing', () => {
      mockBillingBalance = { amountMicros: 100 }
      const { monthlyBonusCredits } = mountComposable()
      expect(monthlyBonusCredits.value).toBe('0')
    })

    it('should format cloudCreditBalanceMicros correctly', () => {
      mockBillingBalance = {
        amountMicros: 300,
        cloudCreditBalanceMicros: 200
      }
      const { monthlyBonusCredits } = mountComposable()
      expect(monthlyBonusCredits.value).toBe('422')
    })
  })

  describe('prepaidCredits', () => {
    it('should return "0" when prepaidBalanceMicros is missing', () => {
      mockBillingBalance = { amountMicros: 100 }
      const { prepaidCredits } = mountComposable()
      expect(prepaidCredits.value).toBe('0')
    })

    it('should format prepaidBalanceMicros correctly', () => {
      mockBillingBalance = {
        amountMicros: 500,
        prepaidBalanceMicros: 300
      }
      const { prepaidCredits } = mountComposable()
      expect(prepaidCredits.value).toBe('633')
    })
  })

  describe('numeric credit values (micros-as-cents)', () => {
    it('converts the monthly and prepaid balance fields from cents to credits (×2.11)', () => {
      mockBillingBalance = {
        amountMicros: 500,
        cloudCreditBalanceMicros: 200,
        prepaidBalanceMicros: 300
      }
      const { monthlyBonusCreditsValue, prepaidCreditsValue } =
        mountComposable()
      expect(monthlyBonusCreditsValue.value).toBe(422)
      expect(prepaidCreditsValue.value).toBe(633)
    })

    it('defaults missing fields to zero', () => {
      mockBillingBalance = { amountMicros: 100 }
      const { monthlyBonusCreditsValue, prepaidCreditsValue } =
        mountComposable()
      expect(monthlyBonusCreditsValue.value).toBe(0)
      expect(prepaidCreditsValue.value).toBe(0)
    })
  })

  describe('isLoadingBalance', () => {
    it('should reflect billingContext.isLoading', () => {
      mockBillingIsLoading = true
      const { isLoadingBalance } = mountComposable()
      expect(isLoadingBalance.value).toBe(true)

      mockBillingIsLoading = false
      const { isLoadingBalance: reloaded } = mountComposable()
      expect(reloaded.value).toBe(false)
    })
  })
})
