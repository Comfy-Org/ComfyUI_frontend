import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useEduPricing } from '@/platform/cloud/subscription/composables/useEduPricing'

const mockEduFlag = ref(false)
const mockIsEduCustomer = ref(false)

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get eduPricingEnabled() {
        return mockEduFlag.value
      }
    }
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    isEduCustomer: computed(() => mockIsEduCustomer.value)
  })
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

describe('useEduPricing', () => {
  it('is inactive unless both the flag and the customer marker are set', () => {
    const { isEduPricingActive } = useEduPricing()

    mockEduFlag.value = false
    mockIsEduCustomer.value = true
    expect(isEduPricingActive.value).toBe(false)

    mockEduFlag.value = true
    mockIsEduCustomer.value = false
    expect(isEduPricingActive.value).toBe(false)

    mockEduFlag.value = true
    mockIsEduCustomer.value = true
    expect(isEduPricingActive.value).toBe(true)
  })

  it('dev override fakes the customer marker', () => {
    mockEduFlag.value = true
    mockIsEduCustomer.value = false
    localStorage.setItem('ff:edu_customer', 'true')

    const { isEduPricingActive } = useEduPricing()
    expect(isEduPricingActive.value).toBe(true)

    localStorage.removeItem('ff:edu_customer')
  })
})
