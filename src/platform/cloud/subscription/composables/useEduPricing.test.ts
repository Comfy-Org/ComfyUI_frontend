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
})
