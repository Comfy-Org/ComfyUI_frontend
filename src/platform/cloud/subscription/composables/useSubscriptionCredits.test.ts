import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import * as comfyCredits from '@/base/credits/comfyCredits'
import { useSubscriptionCredits as createSubscriptionCredits } from '@/platform/cloud/subscription/composables/useSubscriptionCredits'

// Shared mock state (reset in beforeEach)
let mockBillingBalance: {
  amountMicros: number
  cloudCreditBalanceMicros?: number
  prepaidBalanceMicros?: number
} | null = null
let mockBillingIsLoading = false

// Mock useBillingContext - returns computed refs that read from module-level state
vi.mock<unknown>(import('@/composables/billing/useBillingContext'), () => ({
  useBillingContext: () => ({
    balance: computed(() => mockBillingBalance),
    isLoading: computed(() => mockBillingIsLoading)
  })
}))

const apps: App<Element>[] = []

function useSubscriptionCredits(): ReturnType<
  typeof createSubscriptionCredits
> {
  let result: ReturnType<typeof createSubscriptionCredits> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        result = createSubscriptionCredits()
        return () => null
      }
    })
  )
  app.use(
    createI18n({
      legacy: false,
      locale: 'en-US',
      messages: { 'en-US': {} }
    })
  )
  app.mount(document.createElement('div'))
  apps.push(app)
  if (!result) throw new Error('subscription credits not initialized')
  return result
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
})

describe('useSubscriptionCredits', () => {
  beforeEach(() => {
    mockBillingBalance = null
    mockBillingIsLoading = false
  })

  describe('totalCredits', () => {
    it('should return "0" when balance is null', () => {
      mockBillingBalance = null
      const { totalCredits } = useSubscriptionCredits()
      expect(totalCredits.value).toBe('0')
    })

    it('should format amountMicros correctly', () => {
      mockBillingBalance = { amountMicros: 100 }
      const { totalCredits } = useSubscriptionCredits()
      expect(totalCredits.value).toBe('211')
    })

    it('should handle formatting errors by throwing', () => {
      const formatSpy = vi.spyOn(comfyCredits, 'formatCreditsFromCents')
      formatSpy.mockImplementationOnce(() => {
        throw new Error('Formatting error')
      })

      mockBillingBalance = { amountMicros: 100 }
      const { totalCredits } = useSubscriptionCredits()
      expect(() => totalCredits.value).toThrow('Formatting error')
      formatSpy.mockRestore()
    })
  })

  describe('monthlyBonusCredits', () => {
    it('should return "0" when cloudCreditBalanceMicros is missing', () => {
      mockBillingBalance = { amountMicros: 100 }
      const { monthlyBonusCredits } = useSubscriptionCredits()
      expect(monthlyBonusCredits.value).toBe('0')
    })

    it('should format cloudCreditBalanceMicros correctly', () => {
      mockBillingBalance = {
        amountMicros: 300,
        cloudCreditBalanceMicros: 200
      }
      const { monthlyBonusCredits } = useSubscriptionCredits()
      expect(monthlyBonusCredits.value).toBe('422')
    })
  })

  describe('prepaidCredits', () => {
    it('should return "0" when prepaidBalanceMicros is missing', () => {
      mockBillingBalance = { amountMicros: 100 }
      const { prepaidCredits } = useSubscriptionCredits()
      expect(prepaidCredits.value).toBe('0')
    })

    it('should format prepaidBalanceMicros correctly', () => {
      mockBillingBalance = {
        amountMicros: 500,
        prepaidBalanceMicros: 300
      }
      const { prepaidCredits } = useSubscriptionCredits()
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
        useSubscriptionCredits()
      expect(monthlyBonusCreditsValue.value).toBe(422)
      expect(prepaidCreditsValue.value).toBe(633)
    })

    it('defaults missing fields to zero', () => {
      mockBillingBalance = { amountMicros: 100 }
      const { monthlyBonusCreditsValue, prepaidCreditsValue } =
        useSubscriptionCredits()
      expect(monthlyBonusCreditsValue.value).toBe(0)
      expect(prepaidCreditsValue.value).toBe(0)
    })
  })

  describe('isLoadingBalance', () => {
    it('should reflect billingContext.isLoading', () => {
      mockBillingIsLoading = true
      const { isLoadingBalance } = useSubscriptionCredits()
      expect(isLoadingBalance.value).toBe(true)

      mockBillingIsLoading = false
      // Need to re-get the composable since computed caches the value
      const { isLoadingBalance: reloaded } = useSubscriptionCredits()
      expect(reloaded.value).toBe(false)
    })
  })
})
