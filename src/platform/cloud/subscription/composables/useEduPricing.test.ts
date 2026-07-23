import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useEduPricing } from '@/platform/cloud/subscription/composables/useEduPricing'

const mockEduFlag = ref(false)
const mockIsEduCustomer = ref(false)
const mockIsCloud = ref(true)
const mockUserEmail = ref<string | null>(null)
const mockIsEmailVerified = ref<boolean | null>(null)

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userEmail: computed(() => mockUserEmail.value)
  })
}))

vi.mock('@/composables/auth/useEmailVerification', () => ({
  useEmailVerification: () => ({
    isEmailVerified: computed(() => mockIsEmailVerified.value)
  })
}))

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

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

describe('useEduPricing', () => {
  afterEach(() => {
    localStorage.removeItem('ff:edu_customer')
    mockIsCloud.value = true
    mockEduFlag.value = false
    mockIsEduCustomer.value = false
    mockUserEmail.value = null
    mockIsEmailVerified.value = null
  })

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

  it('is inactive off cloud builds', () => {
    mockIsCloud.value = false
    mockEduFlag.value = true
    mockIsEduCustomer.value = true

    const { isEduPricingActive } = useEduPricing()
    expect(isEduPricingActive.value).toBe(false)
  })

  it('dev override fakes the customer marker', () => {
    mockEduFlag.value = true
    mockIsEduCustomer.value = false
    localStorage.setItem('ff:edu_customer', 'true')

    const { isEduPricingActive } = useEduPricing()
    expect(isEduPricingActive.value).toBe(true)
  })

  it('nudges an unverified edu email when the flag is on', () => {
    mockEduFlag.value = true
    mockUserEmail.value = 'student@harvard.edu'
    mockIsEmailVerified.value = false

    const { isEduPricingActive, needsEduVerification } = useEduPricing()
    expect(isEduPricingActive.value).toBe(false)
    expect(needsEduVerification.value).toBe(true)
  })

  it('does not nudge when the discount is already active', () => {
    mockEduFlag.value = true
    mockIsEduCustomer.value = true
    mockUserEmail.value = 'student@harvard.edu'
    mockIsEmailVerified.value = false

    expect(useEduPricing().needsEduVerification.value).toBe(false)
  })

  it('does not nudge verified, unknown-state, or non-edu emails', () => {
    mockEduFlag.value = true
    mockUserEmail.value = 'student@harvard.edu'

    mockIsEmailVerified.value = true
    expect(useEduPricing().needsEduVerification.value).toBe(false)

    mockIsEmailVerified.value = null
    expect(useEduPricing().needsEduVerification.value).toBe(false)

    mockIsEmailVerified.value = false
    mockUserEmail.value = 'dev@acme-corp.com'
    expect(useEduPricing().needsEduVerification.value).toBe(false)
  })

  it('does not nudge off-cloud or with the flag off', () => {
    mockUserEmail.value = 'student@harvard.edu'
    mockIsEmailVerified.value = false

    mockEduFlag.value = true
    mockIsCloud.value = false
    expect(useEduPricing().needsEduVerification.value).toBe(false)

    mockIsCloud.value = true
    mockEduFlag.value = false
    expect(useEduPricing().needsEduVerification.value).toBe(false)
  })
})
