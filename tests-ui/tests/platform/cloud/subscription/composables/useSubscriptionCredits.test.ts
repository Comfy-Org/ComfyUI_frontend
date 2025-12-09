import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as comfyCredits from '@/base/credits/comfyCredits'
import { useSubscriptionCredits } from '@/platform/cloud/subscription/composables/useSubscriptionCredits'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    useI18n: () => ({
      t: () => 'Credits',
      locale: { value: 'en-US' }
    })
  }
})

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

describe('useSubscriptionCredits', () => {
  let authStore: ReturnType<typeof useFirebaseAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useFirebaseAuthStore()
    vi.clearAllMocks()
  })

  describe('totalCredits', () => {
    it('should return "0.00 Credits" when balance is null', () => {
      authStore.balance = null
      const { totalCredits } = useSubscriptionCredits()
      expect(totalCredits.value).toBe('0.00 Credits')
    })

    it('should return "0.00 Credits" when amount_micros is missing', () => {
      authStore.balance = {} as any
      const { totalCredits } = useSubscriptionCredits()
      expect(totalCredits.value).toBe('0.00 Credits')
    })

    it('should format amount_micros correctly', () => {
      authStore.balance = { amount_micros: 100 } as any
      const { totalCredits } = useSubscriptionCredits()
      expect(totalCredits.value).toBe('211.00 Credits')
    })

    it('should handle formatting errors by throwing', async () => {
      const formatSpy = vi.spyOn(comfyCredits, 'formatCreditsFromCents')
      formatSpy.mockImplementationOnce(() => {
        throw new Error('Formatting error')
      })

      authStore.balance = { amount_micros: 100 } as any
      const { totalCredits } = useSubscriptionCredits()
      expect(() => totalCredits.value).toThrow('Formatting error')
      formatSpy.mockRestore()
    })
  })

  describe('monthlyBonusCredits', () => {
    it('should return "0.00 Credits" when cloud_credit_balance_micros is missing', () => {
      authStore.balance = {} as any
      const { monthlyBonusCredits } = useSubscriptionCredits()
      expect(monthlyBonusCredits.value).toBe('0.00 Credits')
    })

    it('should format cloud_credit_balance_micros correctly', () => {
      authStore.balance = { cloud_credit_balance_micros: 200 } as any
      const { monthlyBonusCredits } = useSubscriptionCredits()
      expect(monthlyBonusCredits.value).toBe('422.00 Credits')
    })
  })

  describe('prepaidCredits', () => {
    it('should return "0.00 Credits" when prepaid_balance_micros is missing', () => {
      authStore.balance = {} as any
      const { prepaidCredits } = useSubscriptionCredits()
      expect(prepaidCredits.value).toBe('0.00 Credits')
    })

    it('should format prepaid_balance_micros correctly', () => {
      authStore.balance = { prepaid_balance_micros: 300 } as any
      const { prepaidCredits } = useSubscriptionCredits()
      expect(prepaidCredits.value).toBe('633.00 Credits')
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
