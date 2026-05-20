import { FirebaseError } from 'firebase/app'
import {
  AuthErrorCodes,
  GithubAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  onAuthStateChanged,
  onIdTokenChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword
} from 'firebase/auth'
import type { Auth, User, UserCredential } from 'firebase/auth'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useFirebaseAuth } from 'vuefire'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import type { AuthHeader } from '@/types/authTypes'
import type { operations } from '@/types/comfyRegistryTypes'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

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
export type BillingPortalTargetTier = NonNullable<
  NonNullable<
    NonNullable<AccessBillingPortalReqBody>['content']
  >['application/json']
>['target_tier']

export class AuthStoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthStoreError'
  }
}

export const useAuthStore = defineStore('auth', () => {
  const { flags } = useFeatureFlags()

  // State
  const loading = ref(false)
  const currentUser = ref<User | null>(null)
  const isInitialized = ref(false)
  const customerCreated = ref(false)
  const isFetchingBalance = ref(false)

  // Balance state
  const balance = ref<GetCustomerBalanceResponse | null>(null)
  const lastBalanceUpdateTime = ref<Date | null>(null)

  // Token refresh trigger - increments when token is refreshed
  const tokenRefreshTrigger = ref(0)
  /**
   * The user ID for which the initial ID token has been observed.
   * When a token changes for the same user, that is a refresh.
   */
  const lastTokenUserId = ref<string | null>(null)

  function buildApiUrl(path: string) {
    return `${getComfyApiBaseUrl()}${path}`
  }

  // Providers
  const googleProvider = new GoogleAuthProvider()
  googleProvider.addScope('email')
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  })
  const githubProvider = new GithubAuthProvider()
  githubProvider.addScope('user:email')
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
    if (user === null) {
      lastTokenUserId.value = null
      useWorkspaceAuthStore().clearWorkspaceContext()
    }

    // Reset balance when auth state changes
    balance.value = null
    lastBalanceUpdateTime.value = null
  })

  // Listen for token refresh events
  onIdTokenChanged(auth, (user) => {
    if (user && isCloud) {
      // Skip initial token change
      if (lastTokenUserId.value !== user.uid) {
        lastTokenUserId.value = user.uid
        return
      }
      tokenRefreshTrigger.value++
    }
  })

  async function getIdToken(): Promise<string | undefined> {
    if (!currentUser.value) return
    try {
      return await currentUser.value.getIdToken()
    } catch (error: unknown) {
      if (
        error instanceof FirebaseError &&
        error.code === AuthErrorCodes.NETWORK_REQUEST_FAILED
      ) {
        console.warn(
          'Could not authenticate with Firebase. Features requiring authentication might not work.'
        )
        return
      }

      useDialogService().showErrorDialog(error, {
        title: t('errorDialog.defaultTitle'),
        reportType: 'authenticationError'
      })
      console.error(error)
    }
  }

  /**
   * Retrieves the appropriate authentication header for API requests.
   * Checks for authentication in the following order:
   * 1. Workspace token (if team_workspaces_enabled and user has active workspace context)
   * 2. Firebase authentication token (if user is logged in)
   * 3. API key (if stored in the browser's credential manager)
   *
   * @returns {Promise<AuthHeader | null>}
   *   - A LoggedInAuthHeader with Bearer token (workspace or Firebase)
   *   - An ApiKeyAuthHeader with X-API-KEY if API key exists
   *   - null if no authentication method is available
   */
  async function getAuthHeader(): Promise<AuthHeader | null> {
    if (flags.teamWorkspacesEnabled) {
      const wsHeader = useWorkspaceAuthStore().getWorkspaceAuthHeader()
      if (wsHeader) return wsHeader
    }

    const token = await getIdToken()
    if (token) {
      return {
        Authorization: `Bearer ${token}`
      }
    }

    return useApiKeyAuthStore().getAuthHeader()
  }

  /**
   * Returns Firebase auth header for user-scoped endpoints (e.g., /customers/*).
   * Use this for endpoints that need user identity, not workspace context.
   */
  async function getFirebaseAuthHeader(): Promise<AuthHeader | null> {
    const token = await getIdToken()
    return token ? { Authorization: `Bearer ${token}` } : null
  }

  /**
   * Returns the raw auth token (not wrapped in a header object).
   * Priority: workspace token > Firebase token.
   * Use this for WebSocket connections and backend node auth.
   */
  async function getAuthToken(): Promise<string | undefined> {
    if (flags.teamWorkspacesEnabled) {
      const wsToken = useWorkspaceAuthStore().getWorkspaceToken()
      if (wsToken) return wsToken
    }

    return await getIdToken()
  }

  async function getAuthHeaderOrThrow(): Promise<AuthHeader> {
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
    return authHeader
  }

  async function getFirebaseAuthHeaderOrThrow(): Promise<AuthHeader> {
    const authHeader = await getFirebaseAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
    return authHeader
  }

  async function fetchBalance(): Promise<GetCustomerBalanceResponse | null> {
    isFetchingBalance.value = true
    try {
      const authHeader = await getAuthHeader()
      if (!authHeader) {
        throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
      }

      const response = await fetch(buildApiUrl('/customers/balance'), {
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
        throw new AuthStoreError(
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

  async function createCustomer(): Promise<CreateCustomerResponse> {
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    const createCustomerRes = await fetch(buildApiUrl('/customers'), {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      }
    })
    if (!createCustomerRes.ok) {
      throw new AuthStoreError(
        t('toastMessages.failedToCreateCustomer', {
          error: createCustomerRes.statusText
        })
      )
    }

    const createCustomerResJson: CreateCustomerResponse =
      await createCustomerRes.json()
    if (!createCustomerResJson?.id) {
      throw new AuthStoreError(
        t('toastMessages.failedToCreateCustomer', {
          error: 'No customer ID returned'
        })
      )
    }

    return createCustomerResJson
  }

  async function executeAuthAction<T>(
    action: (auth: Auth) => Promise<T>,
    options: {
      createCustomer?: boolean
    } = {}
  ): Promise<T> {
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

  async function login(
    email: string,
    password: string
  ): Promise<UserCredential> {
    const result = await executeAuthAction(
      (authInstance) =>
        signInWithEmailAndPassword(authInstance, email, password),
      { createCustomer: true }
    )

    if (isCloud) {
      useTelemetry()?.trackAuth({
        method: 'email',
        is_new_user: false,
        user_id: result.user.uid,
        email: result.user.email ?? undefined
      })
    }

    return result
  }

  async function register(
    email: string,
    password: string
  ): Promise<UserCredential> {
    const result = await executeAuthAction(
      (authInstance) =>
        createUserWithEmailAndPassword(authInstance, email, password),
      { createCustomer: true }
    )

    if (isCloud) {
      useTelemetry()?.trackAuth({
        method: 'email',
        is_new_user: true,
        user_id: result.user.uid,
        email: result.user.email ?? undefined
      })
    }

    return result
  }

  async function loginWithGoogle(options?: {
    isNewUser?: boolean
  }): Promise<UserCredential> {
    const result = await executeAuthAction(
      (authInstance) => signInWithPopup(authInstance, googleProvider),
      { createCustomer: true }
    )

    if (isCloud) {
      const additionalUserInfo = getAdditionalUserInfo(result)
      useTelemetry()?.trackAuth({
        method: 'google',
        is_new_user:
          options?.isNewUser || additionalUserInfo?.isNewUser || false,
        user_id: result.user.uid,
        email: result.user.email ?? undefined
      })
    }

    return result
  }

  async function loginWithGithub(options?: {
    isNewUser?: boolean
  }): Promise<UserCredential> {
    const result = await executeAuthAction(
      (authInstance) => signInWithPopup(authInstance, githubProvider),
      { createCustomer: true }
    )

    if (isCloud) {
      const additionalUserInfo = getAdditionalUserInfo(result)
      useTelemetry()?.trackAuth({
        method: 'github',
        is_new_user:
          options?.isNewUser || additionalUserInfo?.isNewUser || false,
        user_id: result.user.uid,
        email: result.user.email ?? undefined
      })
    }

    return result
  }

  async function logout(): Promise<void> {
    return executeAuthAction((authInstance) => signOut(authInstance))
  }

  async function sendPasswordReset(email: string): Promise<void> {
    return executeAuthAction((authInstance) =>
      sendPasswordResetEmail(authInstance, email)
    )
  }

  /** Update password for current user */
  async function _updatePassword(newPassword: string): Promise<void> {
    if (!currentUser.value) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
    await updatePassword(currentUser.value, newPassword)
  }

  async function addCredits(
    requestBodyContent: CreditPurchasePayload
  ): Promise<CreditPurchaseResponse> {
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    // Ensure customer was created during login/registration
    if (!customerCreated.value) {
      await createCustomer()
      customerCreated.value = true
    }

    const response = await fetch(buildApiUrl('/customers/credit'), {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBodyContent)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new AuthStoreError(
        t('toastMessages.failedToInitiateCreditPurchase', {
          error: errorData.message
        })
      )
    }

    return response.json()
  }

  async function initiateCreditPurchase(
    requestBodyContent: CreditPurchasePayload
  ): Promise<CreditPurchaseResponse> {
    return executeAuthAction((_) => addCredits(requestBodyContent))
  }

  async function accessBillingPortal(
    targetTier?: BillingPortalTargetTier
  ): Promise<AccessBillingPortalResponse> {
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    const response = await fetch(buildApiUrl('/customers/billing'), {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      },
      ...(targetTier && {
        body: JSON.stringify({ target_tier: targetTier })
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new AuthStoreError(
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
    tokenRefreshTrigger,

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
    getAuthHeader,
    getAuthHeaderOrThrow,
    getFirebaseAuthHeader,
    getFirebaseAuthHeaderOrThrow,
    getAuthToken
  }
})
