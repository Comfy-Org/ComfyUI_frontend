import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import * as comfyCredits from '@/base/credits/comfyCredits'
import { useBillingContext } from '@/composables/billing/useBillingContext'
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

vi.mock(import('@/composables/billing/useBillingContext'))

function mountComposable(): ReturnType<typeof useSubscriptionCredits> {
  const billing = useBillingContext()
  billing.balance = computed(() =>
    mockBillingBalance ? { ...mockBillingBalance, currency: 'USD' } : null
  )
  billing.isLoading = computed(() => mockBillingIsLoading)
  vi.mocked(useBillingContext).mockReturnValue(billing)

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
    // Replaces `it('should return "0" when balance is null')`: a failed or
    // absent balance read is unknown, and rendering it as `0` told the user
    // their whole balance was gone while the ledger was untouched (FE-3164).
    it('should not report a null balance as zero', () => {
      mockBillingBalance = null
      const { totalCredits, isBalanceUnavailable } = mountComposable()
      expect(totalCredits.value).not.toBe('0')
      expect(totalCredits.value).toBeNull()
      expect(isBalanceUnavailable.value).toBe(true)
    })

    it('should leave a known balance of zero reading "0"', () => {
      mockBillingBalance = { amountMicros: 0 }
      const { totalCredits, isBalanceUnavailable } = mountComposable()
      expect(totalCredits.value).toBe('0')
      expect(isBalanceUnavailable.value).toBe(false)
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
    it('should not report a null balance as zero', () => {
      mockBillingBalance = null
      const { monthlyBonusCredits } = mountComposable()
      expect(monthlyBonusCredits.value).toBeNull()
    })

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
    it('should not report a null balance as zero', () => {
      mockBillingBalance = null
      const { prepaidCredits } = mountComposable()
      expect(prepaidCredits.value).toBeNull()
    })

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

  describe('isBalanceUnavailable', () => {
    // A null balance while a read is in flight is pending, not unavailable.
    // Conflating the two makes the surfaces claim the figure is unknown while
    // they are still loading it, which unmounts their loading skeletons.
    it('should stay false while a balance read is in flight', () => {
      mockBillingBalance = null
      mockBillingIsLoading = true
      const { isBalanceUnavailable, totalCredits } = mountComposable()
      expect(isBalanceUnavailable.value).toBe(false)
      // The figure is still withheld — only the *claim* waits for the read.
      expect(totalCredits.value).toBeNull()
    })

    it('should become true once a read has finished without a balance', () => {
      mockBillingBalance = null
      mockBillingIsLoading = false
      const { isBalanceUnavailable } = mountComposable()
      expect(isBalanceUnavailable.value).toBe(true)
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
