import {
  type Auth,
  GithubAuthProvider,
  GoogleAuthProvider,
  type User,
  type UserCredential,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'firebase/auth'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useFirebaseAuth } from 'vuefire'

import { COMFY_API_BASE_URL } from '@/config/comfyApi'
import { t } from '@/i18n'
import { useDialogService } from '@/services/dialogService'
import { operations } from '@/types/comfyRegistryTypes'

import { useToastStore } from './toastStore'

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

export const useFirebaseAuthStore = defineStore('firebaseAuth', () => {
  // State
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentUser = ref<User | null>(null)
  const isInitialized = ref(false)
  const customerCreated = ref(false)
  const isFetchingBalance = ref(false)

  // Balance state
  const balance = ref<GetCustomerBalanceResponse | null>(null)
  const lastBalanceUpdateTime = ref<Date | null>(null)

  // Providers
  const googleProvider = new GoogleAuthProvider()
  const githubProvider = new GithubAuthProvider()

  // Getters
  const isAuthenticated = computed(() => !!currentUser.value)
  const userEmail = computed(() => currentUser.value?.email)
  const userId = computed(() => currentUser.value?.uid)

  // Get auth from VueFire and listen for auth state changes
  const auth = useFirebaseAuth()
  if (auth) {
    // Set persistence to localStorage (works in both browser and Electron)
    void setPersistence(auth, browserLocalPersistence)

    onAuthStateChanged(auth, (user) => {
      currentUser.value = user
      isInitialized.value = true

      // Reset balance when auth state changes
      balance.value = null
      lastBalanceUpdateTime.value = null
    })
  } else {
    error.value = 'Firebase Auth not available from VueFire'
  }

  const showAuthErrorToast = () => {
    useToastStore().add({
      summary: t('g.error'),
      detail: t('auth.login.genericErrorMessage', {
        supportEmail: 'support@comfy.org'
      }),
      severity: 'error'
    })
  }

  const getIdToken = async (): Promise<string | null> => {
    if (currentUser.value) {
      return currentUser.value.getIdToken()
    }
    return null
  }

  const fetchBalance = async (): Promise<GetCustomerBalanceResponse | null> => {
    isFetchingBalance.value = true
    try {
      const token = await getIdToken()
      if (!token) {
        error.value = 'Cannot fetch balance: User not authenticated'
        isFetchingBalance.value = false
        return null
      }

      const response = await fetch(`${COMFY_API_BASE_URL}/customers/balance`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Customer not found is expected for new users
          return null
        }
        const errorData = await response.json()
        error.value = `Failed to fetch balance: ${errorData.message}`
        return null
      }

      const balanceData = await response.json()
      // Update the last balance update time
      lastBalanceUpdateTime.value = new Date()
      balance.value = balanceData
      return balanceData
    } catch (e) {
      error.value = `Failed to fetch balance: ${e}`
      return null
    } finally {
      isFetchingBalance.value = false
    }
  }

  const createCustomer = async (
    token: string
  ): Promise<CreateCustomerResponse> => {
    const createCustomerRes = await fetch(`${COMFY_API_BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })
    if (!createCustomerRes.ok) {
      throw new Error(
        `Failed to create customer: ${createCustomerRes.statusText}`
      )
    }

    const createCustomerResJson: CreateCustomerResponse =
      await createCustomerRes.json()
    if (!createCustomerResJson?.id) {
      throw new Error('Failed to create customer: No customer ID returned')
    }

    return createCustomerResJson
  }

  const executeAuthAction = async <T>(
    action: (auth: Auth) => Promise<T>,
    options: {
      createCustomer?: boolean
    } = {}
  ): Promise<T> => {
    if (!auth) throw new Error('Firebase Auth not initialized')

    loading.value = true
    error.value = null

    try {
      const result = await action(auth)

      // Create customer if needed
      if (options?.createCustomer) {
        const token = await getIdToken()
        if (!token) {
          throw new Error('Cannot create customer: User not authenticated')
        }
        await createCustomer(token)
      }

      return result
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      showAuthErrorToast()
      throw e
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

  const addCredits = async (
    requestBodyContent: CreditPurchasePayload
  ): Promise<CreditPurchaseResponse | null> => {
    const token = await getIdToken()
    if (!token) {
      error.value = 'Cannot add credits: User not authenticated'
      return null
    }

    // Ensure customer was created during login/registration
    if (!customerCreated.value) {
      await createCustomer(token)
      customerCreated.value = true
    }

    const response = await fetch(`${COMFY_API_BASE_URL}/customers/credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(requestBodyContent)
    })

    if (!response.ok) {
      const errorData = await response.json()
      error.value = `Failed to initiate credit purchase: ${errorData.message}`
      showAuthErrorToast()
      return null
    }

    return response.json()
  }

  const initiateCreditPurchase = async (
    requestBodyContent: CreditPurchasePayload
  ): Promise<CreditPurchaseResponse | null> =>
    executeAuthAction((_) => addCredits(requestBodyContent))

  const openSignInPanel = () => {
    useDialogService().showSettingsDialog('user')
  }

  const openCreditsPanel = () => {
    useDialogService().showSettingsDialog('credits')
  }

  const accessBillingPortal = async (
    requestBody?: AccessBillingPortalReqBody
  ): Promise<AccessBillingPortalResponse | null> => {
    const token = await getIdToken()
    if (!token) {
      error.value = 'Cannot access billing portal: User not authenticated'
      return null
    }

    const response = await fetch(`${COMFY_API_BASE_URL}/customers/billing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      ...(requestBody && {
        body: JSON.stringify(requestBody)
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      error.value = `Failed to access billing portal: ${errorData.message}`
      showAuthErrorToast()
      return null
    }

    return response.json()
  }

  return {
    // State
    loading,
    error,
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
    getIdToken,
    loginWithGoogle,
    loginWithGithub,
    initiateCreditPurchase,
    openSignInPanel,
    openCreditsPanel,
    fetchBalance,
    accessBillingPortal
  }
})
