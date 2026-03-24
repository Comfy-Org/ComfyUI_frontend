import type { Mock } from 'vitest'
import { computed, reactive, ref } from 'vue'

/**
 * Shared mock factory for useAuthStore.
 *
 * Usage in test files:
 *   import { createAuthStoreMock, mockAuthStoreModule } from '@/stores/__tests__/authStoreMock'
 *
 *   const { mock, controls } = createAuthStoreMock()
 *   vi.mock('@/stores/authStore', () => mockAuthStoreModule(mock))
 *
 *   // Per-test customization:
 *   controls.currentUser.value = { uid: 'test-123', email: 'a@b.com' }
 *   controls.getAuthHeader.mockResolvedValue({ Authorization: 'Bearer tok' })
 */

export interface AuthStoreMockControls {
  currentUser: ReturnType<typeof ref<Record<string, unknown> | null>>
  isInitialized: ReturnType<typeof ref<boolean>>
  loading: ReturnType<typeof ref<boolean>>
  balance: ReturnType<typeof ref<Record<string, unknown> | null>>
  isFetchingBalance: ReturnType<typeof ref<boolean>>
  tokenRefreshTrigger: ReturnType<typeof ref<number>>

  login: Mock
  register: Mock
  logout: Mock
  getIdToken: Mock
  getAuthHeader: Mock
  getFirebaseAuthHeader: Mock
  getAuthToken: Mock
  createCustomer: Mock
  fetchBalance: Mock
  accessBillingPortal: Mock
  loginWithGoogle: Mock
  loginWithGithub: Mock
  sendPasswordReset: Mock
  updatePassword: Mock
  initiateCreditPurchase: Mock
}

export function createAuthStoreMock(): {
  mock: Record<string, unknown>
  controls: AuthStoreMockControls
} {
  const currentUser = ref<Record<string, unknown> | null>(null)
  const isInitialized = ref(false)
  const loading = ref(false)
  const balance = ref<Record<string, unknown> | null>(null)
  const isFetchingBalance = ref(false)
  const tokenRefreshTrigger = ref(0)

  const controls: AuthStoreMockControls = {
    currentUser,
    isInitialized,
    loading,
    balance,
    isFetchingBalance,
    tokenRefreshTrigger,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
    getAuthHeader: vi.fn().mockResolvedValue(null),
    getFirebaseAuthHeader: vi.fn().mockResolvedValue(null),
    getAuthToken: vi.fn().mockResolvedValue(undefined),
    createCustomer: vi.fn(),
    fetchBalance: vi.fn(),
    accessBillingPortal: vi.fn(),
    loginWithGoogle: vi.fn(),
    loginWithGithub: vi.fn(),
    sendPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
    initiateCreditPurchase: vi.fn()
  }

  const mock = reactive({
    ...controls,
    isAuthenticated: computed(() => !!currentUser.value),
    userEmail: computed(
      () => (currentUser.value as Record<string, unknown> | null)?.email ?? null
    ),
    userId: computed(
      () => (currentUser.value as Record<string, unknown> | null)?.uid ?? null
    )
  })

  return { mock, controls }
}

export function mockAuthStoreModule(mock: Record<string, unknown>) {
  return {
    useAuthStore: () => mock,
    AuthStoreError: class extends Error {
      constructor(message: string) {
        super(message)
        this.name = 'AuthStoreError'
      }
    }
  }
}
