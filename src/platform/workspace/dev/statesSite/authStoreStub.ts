/**
 * Build-time replacement for `@/stores/authStore` in the states viewer
 * (wired via alias in vite.states.config.mts). Supplies an authenticated
 * session without Firebase so API layers build headers and reach fetch,
 * where billingMockHarness intercepts every request.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export class AuthStoreError extends Error {}

export type BillingPortalTargetTier = string

const TOKEN = 'states-site-mock-token'
const HEADER = { Authorization: `Bearer ${TOKEN}` }

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref({
    uid: 'user-self',
    email: 'alextov@comfy.org',
    displayName: 'Alex Tov',
    photoURL: null,
    providerData: [{ providerId: 'google.com' }],
    getIdToken: async () => TOKEN
  })

  return {
    loading: ref(false),
    currentUser,
    isInitialized: ref(true),
    balance: ref(null),
    lastBalanceUpdateTime: ref(null),
    isFetchingBalance: ref(false),
    tokenRefreshTrigger: ref(0),

    isAuthenticated: computed(() => true),
    userEmail: computed(() => 'alextov@comfy.org'),
    userId: computed(() => 'user-self'),

    login: async () => {},
    register: async () => {},
    logout: async () => {},
    createCustomer: async () => {},
    getIdToken: async () => TOKEN,
    loginWithGoogle: async () => {},
    loginWithGithub: async () => {},
    initiateCreditPurchase: async () => {},
    fetchBalance: async () => {},
    accessBillingPortal: async () => {},
    sendPasswordReset: async () => {},
    updatePassword: async () => {},
    getAuthHeader: async () => HEADER,
    getAuthHeaderOrThrow: async () => HEADER,
    getFirebaseAuthHeader: async () => HEADER,
    getFirebaseAuthHeaderOrThrow: async () => HEADER,
    getAuthToken: async () => TOKEN,
    notifyTokenRefreshed: () => {}
  }
})
