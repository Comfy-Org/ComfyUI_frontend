import {
  type Auth,
  GithubAuthProvider,
  GoogleAuthProvider,
  type User,
  type UserCredential,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword
} from 'firebase/auth'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useFirebaseAuth } from 'vuefire'

import { COMFY_API_BASE_URL } from '@/config/comfyApi'
import { t } from '@/i18n'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { type AuthHeader } from '@/types/authTypes'
import { operations } from '@/types/comfyRegistryTypes'

type CreditPurchaseResponse =
  operations['InitiateCreditPurchase']['responses']['201']['content']['application/json']
type CreditPurchasePayload =
  operations['InitiateCreditPurchase']['requestBody']['content']['application/json']
type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']
type GetCustomerBalanceResponse =
  operations['GetCustomerBalance']['responses']['200']['content']['application/json']
type AccessBillingPortalResponse =
  operations['AccessBillingPortal']['responses']['200']['content']['application/json']
type AccessBillingPortalReqBody =
  operations['AccessBillingPortal']['requestBody']

export class FirebaseAuthStoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FirebaseAuthStoreError'
  }
}

export const useFirebaseAuthStore = defineStore('firebaseAuth', () => {
  // State
  const loading = ref(false)
  const currentUser = ref<User | null>(null)
  const isInitialized = ref(false)
  const customerCreated = ref(false)
  const isFetchingBalance = ref(false)

  // Balance state
  const balance = ref<GetCustomerBalanceResponse | null>(null)
  const lastBalanceUpdateTime = ref<Date | null>(null)

  // Providers
  const googleProvider = new GoogleAuthProvider()
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  })
  const githubProvider = new GithubAuthProvider()
  githubProvider.setCustomParameters({
    prompt: 'select_account'
  })

  // Getters
  const isAuthenticated = computed(() => !!currentUser.value)
  const userEmail = computed(() => currentUser.value?.email)
  const userId = computed(() => currentUser.value?.uid)

  // Get auth from VueFire and listen for auth state changes
  // From useFirebaseAuth docs:
  // Retrieves the Firebase Auth instance. Returns `null` on the server.
  // When using this function on the client in TypeScript, you can force the type with `useFirebaseAuth()!`.
  const auth = useFirebaseAuth()!
  // Set persistence to localStorage (works in both browser and Electron)
  void setPersistence(auth, browserLocalPersistence)

  onAuthStateChanged(auth, (user) => {
    currentUser.value = user
    isInitialized.value = true

    // Reset balance when auth state changes
    balance.value = null
    lastBalanceUpdateTime.value = null
  })

  const getIdToken = async (): Promise<string | null> => {
    if (currentUser.value) {
      return currentUser.value.getIdToken()
    }
    return null
  }

  /**
   * Retrieves the appropriate authentication header for API requests.
   * Checks for authentication in the following order:
   * 1. Firebase authentication token (if user is logged in)
   * 2. API key (if stored in the browser's credential manager)
   *
   * @returns {Promise<AuthHeader | null>}
   *   - A LoggedInAuthHeader with Bearer token if Firebase authenticated
   *   - An ApiKeyAuthHeader with X-API-KEY if API key exists
   *   - null if neither authentication method is available
   */
  const getAuthHeader = async (): Promise<AuthHeader | null> => {
    // If available, set header with JWT used to identify the user to Firebase service
    const token = await getIdToken()
    if (token) {
      return {
        Authorization: `Bearer ${token}`
      }
    }

    // If not authenticated with Firebase, try falling back to API key if available
    return useApiKeyAuthStore().getAuthHeader()
  }

  const fetchBalance = async (): Promise<GetCustomerBalanceResponse | null> => {
    isFetchingBalance.value = true
    try {
      const authHeader = await getAuthHeader()
      if (!authHeader) {
        throw new FirebaseAuthStoreError(
          t('toastMessages.userNotAuthenticated')
        )
      }

      const response = await fetch(`${COMFY_API_BASE_URL}/customers/balance`, {
        headers: {
          ...authHeader,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Customer not found is expected for new users
          return null
        }
        const errorData = await response.json()
        throw new FirebaseAuthStoreError(
          t('toastMessages.failedToFetchBalance', {
            error: errorData.message
          })
        )
      }

      const balanceData = await response.json()
      // Update the last balance update time
      lastBalanceUpdateTime.value = new Date()
      balance.value = balanceData
      return balanceData
    } finally {
      isFetchingBalance.value = false
    }
  }

  const createCustomer = async (): Promise<CreateCustomerResponse> => {
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new FirebaseAuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    const createCustomerRes = await fetch(`${COMFY_API_BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      }
    })
    if (!createCustomerRes.ok) {
      throw new FirebaseAuthStoreError(
        t('toastMessages.failedToCreateCustomer', {
          error: createCustomerRes.statusText
        })
      )
    }

    const createCustomerResJson: CreateCustomerResponse =
      await createCustomerRes.json()
    if (!createCustomerResJson?.id) {
      throw new FirebaseAuthStoreError(
        t('toastMessages.failedToCreateCustomer', {
          error: 'No customer ID returned'
        })
      )
    }

    return createCustomerResJson
  }

  const executeAuthAction = async <T>(
    action: (auth: Auth) => Promise<T>,
    options: {
      createCustomer?: boolean
    } = {}
  ): Promise<T> => {
    loading.value = true

    try {
      const result = await action(auth)

      // Create customer if needed
      if (options?.createCustomer) {
        const token = await getIdToken()
        if (!token) {
          throw new Error('Cannot create customer: User not authenticated')
        }
        await createCustomer()
      }

      return result
    } finally {
      loading.value = false
    }
  }

  const login = async (
    email: string,
    password: string
  ): Promise<UserCredential> =>
    executeAuthAction(
      (authInstance) =>
        signInWithEmailAndPassword(authInstance, email, password),
      { createCustomer: true }
    )

  const register = async (
    email: string,
    password: string
  ): Promise<UserCredential> => {
    return executeAuthAction(
      (authInstance) =>
        createUserWithEmailAndPassword(authInstance, email, password),
      { createCustomer: true }
    )
  }

  const loginWithGoogle = async (): Promise<UserCredential> =>
    executeAuthAction(
      (authInstance) => signInWithPopup(authInstance, googleProvider),
      { createCustomer: true }
    )

  const loginWithGithub = async (): Promise<UserCredential> =>
    executeAuthAction(
      (authInstance) => signInWithPopup(authInstance, githubProvider),
      { createCustomer: true }
    )

  const logout = async (): Promise<void> =>
    executeAuthAction((authInstance) => signOut(authInstance))

  const sendPasswordReset = async (email: string): Promise<void> =>
    executeAuthAction((authInstance) =>
      sendPasswordResetEmail(authInstance, email)
    )

  /** Update password for current user */
  const _updatePassword = async (newPassword: string): Promise<void> => {
    if (!currentUser.value) {
      throw new FirebaseAuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
    await updatePassword(currentUser.value, newPassword)
  }

  const addCredits = async (
    requestBodyContent: CreditPurchasePayload
  ): Promise<CreditPurchaseResponse> => {
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new FirebaseAuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    // Ensure customer was created during login/registration
    if (!customerCreated.value) {
      await createCustomer()
      customerCreated.value = true
    }

    const response = await fetch(`${COMFY_API_BASE_URL}/customers/credit`, {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBodyContent)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new FirebaseAuthStoreError(
        t('toastMessages.failedToInitiateCreditPurchase', {
          error: errorData.message
        })
      )
    }

    return response.json()
  }

  const initiateCreditPurchase = async (
    requestBodyContent: CreditPurchasePayload
  ): Promise<CreditPurchaseResponse> =>
    executeAuthAction((_) => addCredits(requestBodyContent))

  const accessBillingPortal = async (
    requestBody?: AccessBillingPortalReqBody
  ): Promise<AccessBillingPortalResponse> => {
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new FirebaseAuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    const response = await fetch(`${COMFY_API_BASE_URL}/customers/billing`, {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      },
      ...(requestBody && {
        body: JSON.stringify(requestBody)
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new FirebaseAuthStoreError(
        t('toastMessages.failedToAccessBillingPortal', {
          error: errorData.message
        })
      )
    }

    return response.json()
  }

  return {
    // State
    loading,
    currentUser,
    isInitialized,
    balance,
    lastBalanceUpdateTime,
    isFetchingBalance,

    // Getters
    isAuthenticated,
    userEmail,
    userId,

    // Actions
    login,
    register,
    logout,
    createCustomer,
    getIdToken,
    loginWithGoogle,
    loginWithGithub,
    initiateCreditPurchase,
    fetchBalance,
    accessBillingPortal,
    sendPasswordReset,
    updatePassword: _updatePassword,
    getAuthHeader
  }
})
