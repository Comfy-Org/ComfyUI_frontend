import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscriptionCredits } from '@/platform/cloud/subscription/composables/useSubscriptionCredits'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

// Mock Firebase Auth and related modules
vi.mock('vuefire', () => ({
  useFirebaseAuth: vi.fn(() => ({
    onAuthStateChanged: vi.fn(),
    setPersistence: vi.fn()
  }))
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => {
    // Mock the callback to be called immediately for testing
    return vi.fn()
  }),
  onIdTokenChanged: vi.fn(),
  setPersistence: vi.fn().mockResolvedValue(undefined),
  browserLocalPersistence: {},
  GoogleAuthProvider: class {
    addScope = vi.fn()
    setCustomParameters = vi.fn()
  },
  GithubAuthProvider: class {
    addScope = vi.fn()
    setCustomParameters = vi.fn()
  }
}))

// Mock other dependencies
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showDialog: vi.fn()
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    track: vi.fn()
  })
}))

vi.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({
    add: vi.fn()
  })
}))

vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => ({
    headers: {}
  })
}))

// Mock formatMetronomeCurrency
vi.mock('@/utils/formatUtil', () => ({
  formatMetronomeCurrency: vi.fn((micros: number) => {
    // Simple mock that converts micros to dollars
    return (micros / 1000000).toFixed(2)
  })
}))

describe('useSubscriptionCredits', () => {
  let authStore: ReturnType<typeof useFirebaseAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useFirebaseAuthStore()
    vi.clearAllMocks()
  })

  describe('totalCredits', () => {
    it('should return "0.00" when balance is null', () => {
      authStore.balance = null
      const { totalCredits } = useSubscriptionCredits()
      expect(totalCredits.value).toBe('0.00')
    })

    it('should return "0.00" when amount_micros is missing', () => {
      authStore.balance = {} as any
      const { totalCredits } = useSubscriptionCredits()
      expect(totalCredits.value).toBe('0.00')
    })

    it('should format amount_micros correctly', () => {
      authStore.balance = { amount_micros: 5000000 } as any
      const { totalCredits } = useSubscriptionCredits()
      expect(totalCredits.value).toBe('5.00')
    })

    it('should handle formatting errors gracefully', async () => {
      const mockFormatMetronomeCurrency = vi.mocked(
        await import('@/utils/formatUtil')
      ).formatMetronomeCurrency
      mockFormatMetronomeCurrency.mockImplementationOnce(() => {
        throw new Error('Formatting error')
      })

      authStore.balance = { amount_micros: 5000000 } as any
      const { totalCredits } = useSubscriptionCredits()
      expect(totalCredits.value).toBe('0.00')
    })
  })

  describe('monthlyBonusCredits', () => {
    it('should return "0.00" when cloud_credit_balance_micros is missing', () => {
      authStore.balance = {} as any
      const { monthlyBonusCredits } = useSubscriptionCredits()
      expect(monthlyBonusCredits.value).toBe('0.00')
    })

    it('should format cloud_credit_balance_micros correctly', () => {
      authStore.balance = { cloud_credit_balance_micros: 2500000 } as any
      const { monthlyBonusCredits } = useSubscriptionCredits()
      expect(monthlyBonusCredits.value).toBe('2.50')
    })
  })

  describe('prepaidCredits', () => {
    it('should return "0.00" when prepaid_balance_micros is missing', () => {
      authStore.balance = {} as any
      const { prepaidCredits } = useSubscriptionCredits()
      expect(prepaidCredits.value).toBe('0.00')
    })

    it('should format prepaid_balance_micros correctly', () => {
      authStore.balance = { prepaid_balance_micros: 7500000 } as any
      const { prepaidCredits } = useSubscriptionCredits()
      expect(prepaidCredits.value).toBe('7.50')
    })
  })

  describe('isLoadingBalance', () => {
    it('should reflect authStore.isFetchingBalance', () => {
      authStore.isFetchingBalance = true
      const { isLoadingBalance } = useSubscriptionCredits()
      expect(isLoadingBalance.value).toBe(true)

      authStore.isFetchingBalance = false
      expect(isLoadingBalance.value).toBe(false)
    })
  })
})
