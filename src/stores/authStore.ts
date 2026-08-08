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
import { fetchWithUnifiedRemint } from '@/platform/auth/unified/remintRetry'
import { DISTRIBUTION, isCloud } from '@/platform/distribution/types'
import {
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useTelemetry } from '@/platform/telemetry'
import { api } from '@/scripts/api'
import { useDialogService } from '@/services/dialogService'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import type { AuthHeader } from '@/types/authTypes'
import type { operations } from '@/types/comfyRegistryTypes'
import { parseErrorResponse } from '@/platform/remote/comfyui/errors'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

type CreditPurchaseResponse =
  operations['InitiateCreditPurchase']['responses']['201']['content']['application/json']
type CreditPurchasePayload =
  operations['InitiateCreditPurchase']['requestBody']['content']['application/json']
type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']
type CreateCustomerPayload = NonNullable<
  operations['createCustomer']['requestBody']
>['content']['application/json']
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
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AuthStoreError'
    this.status = status
  }
}

export const useAuthStore = defineStore('auth', () => {
  const { flags } = useFeatureFlags()

  // State
  const loading = ref(false)
  const currentUser = ref<User | null>(null)
  const isInitialized = ref(false)
  const customerCreated = ref(false)
  /**
   * Memoizes the in-flight or successful customer provisioning attempt for
   * the current account (see recoverMissingCustomer). Declared here so the
   * auth-state listener below can reset it before its initializer would
   * otherwise run.
   */
  let customerRecovery: Promise<void> | null = null
  let customerRecoveryUid: string | undefined
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

  const buildApiUrl = (path: string) => `${getComfyApiBaseUrl()}${path}`

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

  function getShareAuthMetadata() {
    const shareId = getPreservedQueryParam(
      PRESERVED_QUERY_NAMESPACES.SHARE_AUTH,
      'share'
    )
    if (shareId) clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.SHARE_AUTH)
    return shareId ? { share_id: shareId } : {}
  }

  // Get auth from VueFire and listen for auth state changes
  // From useFirebaseAuth docs:
  // Retrieves the Firebase Auth instance. Returns `null` on the server.
  // When using this function on the client in TypeScript, you can force the type with `useFirebaseAuth()!`.
  const auth = useFirebaseAuth()!
  // Set persistence to localStorage (works in both browser and Electron)
  void setPersistence(auth, browserLocalPersistence)

  onAuthStateChanged(auth, (user) => {
    const previousUserId = currentUser.value?.uid ?? null
    const identityChanged =
      previousUserId !== null && previousUserId !== (user?.uid ?? null)

    if (user === null || identityChanged) {
      useWorkspaceAuthStore().clearWorkspaceContext()
    }
    if (identityChanged) {
      useTeamWorkspaceStore().resetForIdentityChange()
    }

    // A direct account switch (A -> B, or sign-out) must re-handshake the
    // realtime socket so a tab stops receiving the previous account's live
    // events. The initial connect is owned by api.init(), so only react once an
    // identity has been recorded (`identityChanged` is false on first sign-in).
    if (isCloud && identityChanged) {
      void api.resetSocket()
    }

    currentUser.value = user
    isInitialized.value = true
    if (user === null) {
      lastTokenUserId.value = null
    } else if (isCloud) {
      // Mint the single Cloud JWT at login (flag-guarded inside the store; a
      // no-op when unified_cloud_auth is off).
      void useWorkspaceAuthStore().mintAtLogin()
    }

    // Reset balance when auth state changes
    balance.value = null
    lastBalanceUpdateTime.value = null

    // Customer provisioning state is per-account: without this reset, a
    // second account in the same browser session would be short-circuited by
    // the previous account's memoized recovery and stay stuck on 409s.
    customerCreated.value = false
    customerRecovery = null
    customerRecoveryUid = undefined
  })

  // Listen for token refresh events
  onIdTokenChanged(auth, (user) => {
    if (user && isCloud) {
      // Skip initial token change
      if (lastTokenUserId.value !== user.uid) {
        lastTokenUserId.value = user.uid
        return
      }
      // Under unified_cloud_auth the Cloud-JWT refresh lifecycle drives session
      // cookie rotation (workspaceAuthStore.refreshUnified → notifyTokenRefreshed),
      // so gate this Firebase-driven bump off to avoid a double rotation.
      if (!flags.unifiedCloudAuthEnabled) {
        tokenRefreshTrigger.value++
      }
    }
  })

  /**
   * Bumps the token-refresh trigger so downstream consumers (e.g. session
   * cookie rotation via useCurrentUser) react to a fresh Cloud JWT. Called by
   * the unified refresh lifecycle; under unified_cloud_auth it replaces the
   * Firebase onIdTokenChanged bump above as the sole rotation driver.
   */
  const notifyTokenRefreshed = (): void => {
    tokenRefreshTrigger.value++
  }

  const getIdToken = async (): Promise<string | undefined> => {
    const user = currentUser.value
    if (!user) return
    try {
      const token = await user.getIdToken()
      return currentUser.value?.uid === user.uid ? token : undefined
    } catch (error: unknown) {
      if (currentUser.value?.uid !== user.uid) return
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
   *
   * When unified_cloud_auth is enabled, returns the single Cloud JWT for every
   * cloud request (no Firebase/API-key fallback) so one token is used end to end.
   * Otherwise checks for authentication in the following order:
   * 1. Workspace token on Cloud when the user has active workspace context
   * 2. Firebase authentication token (if user is logged in)
   * 3. API key (if stored in the browser's credential manager)
   *
   * @returns {Promise<AuthHeader | null>}
   *   - A LoggedInAuthHeader with Bearer token (unified Cloud JWT, workspace, or Firebase)
   *   - An ApiKeyAuthHeader with X-API-KEY if API key exists
   *   - null if no authentication method is available
   */
  const getAuthHeader = async (): Promise<AuthHeader | null> => {
    if (flags.unifiedCloudAuthEnabled) {
      const token = useWorkspaceAuthStore().getUnifiedToken()
      return token ? { Authorization: `Bearer ${token}` } : null
    }

    if (isCloud) {
      const workspaceAuth = useWorkspaceAuthStore()
      const activeWorkspaceId = useTeamWorkspaceStore().activeWorkspaceId

      // Recover the workspace token rather than downgrade to the personal
      // identity, which is what makes cloud requests oscillate.
      if (activeWorkspaceId) {
        return workspaceAuth.ensureWorkspaceAuthHeader(activeWorkspaceId)
      }

      const wsHeader = workspaceAuth.getWorkspaceAuthHeader()
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
  const getFirebaseAuthHeader = async (): Promise<AuthHeader | null> => {
    const token = await getIdToken()
    return token ? { Authorization: `Bearer ${token}` } : null
  }

  /**
   * Returns the raw auth token (not wrapped in a header object).
   * When unified_cloud_auth is enabled, returns the single Cloud JWT; otherwise
   * priority is workspace token > Firebase token.
   * Use this for WebSocket connections and backend node auth.
   */
  const getAuthToken = async (): Promise<string | undefined> => {
    if (flags.unifiedCloudAuthEnabled) {
      return useWorkspaceAuthStore().getUnifiedToken()
    }

    if (isCloud) {
      const workspaceAuth = useWorkspaceAuthStore()
      const activeWorkspaceId = useTeamWorkspaceStore().activeWorkspaceId

      // Mirror getAuthHeader for WebSocket/queue auth.
      if (activeWorkspaceId) {
        return (
          (await workspaceAuth.ensureWorkspaceToken(activeWorkspaceId)) ??
          undefined
        )
      }

      const wsToken = workspaceAuth.getWorkspaceToken()
      if (wsToken) return wsToken
    }

    return await getIdToken()
  }

  const getAuthHeaderOrThrow = async (): Promise<AuthHeader> => {
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
    return authHeader
  }

  const getFirebaseAuthHeaderOrThrow = async (): Promise<AuthHeader> => {
    const authHeader = await getFirebaseAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
    return authHeader
  }

  const fetchBalance = async (): Promise<GetCustomerBalanceResponse | null> => {
    isFetchingBalance.value = true
    const requestOwnerUid = currentUser.value?.uid ?? null
    try {
      const authHeader = await getAuthHeader()
      if (!authHeader) {
        throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
      }

      const response = await fetchWithCustomerRecovery(
        buildApiUrl('/customers/balance'),
        {
          headers: {
            ...authHeader,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        if (response.status === 404) {
          // Customer not found is expected for new users
          return null
        }
        const { message } = await parseErrorResponse(response)
        throw new AuthStoreError(
          t('toastMessages.failedToFetchBalance', {
            error: message
          })
        )
      }

      const balanceData = await response.json()
      // A direct A->B account switch nulls balance in onAuthStateChanged; a
      // late-resolving request from the previous identity must not repaint it.
      if ((currentUser.value?.uid ?? null) !== requestOwnerUid) {
        return null
      }
      // Update the last balance update time
      lastBalanceUpdateTime.value = new Date()
      balance.value = balanceData
      return balanceData
    } finally {
      isFetchingBalance.value = false
    }
  }

  const createCustomer = async (
    payload?: Omit<CreateCustomerPayload, 'signup_source'>
  ): Promise<CreateCustomerResponse> => {
    const sessionUserId = currentUser.value?.uid
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    const body: CreateCustomerPayload = {
      ...payload,
      signup_source: DISTRIBUTION
    }

    const createCustomerRes = await fetchWithUnifiedRemint(
      buildApiUrl('/customers'),
      {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      isCloud && flags.unifiedCloudAuthEnabled
    )
    if (!createCustomerRes.ok) {
      throw new AuthStoreError(
        t('toastMessages.failedToCreateCustomer', {
          error: createCustomerRes.statusText
        }),
        createCustomerRes.status
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

    if (currentUser.value?.uid === sessionUserId) {
      customerCreated.value = true
    }
    return createCustomerResJson
  }

  /**
   * Memoizes the customer provisioning attempt so concurrent or repeated 409
   * responses from /customers/* endpoints trigger at most one successful
   * POST /customers per account. A failed attempt is cleared so a later
   * request can retry, e.g. after a transient network failure.
   */
  const recoverMissingCustomer = (): Promise<void> => {
    const sessionUserId = currentUser.value?.uid
    if (customerRecovery === null || customerRecoveryUid !== sessionUserId) {
      const thisRecovery: Promise<void> = createCustomer()
        .then(() => undefined)
        .catch((error: unknown) => {
          if (customerRecovery === thisRecovery) {
            customerRecovery = null
            customerRecoveryUid = undefined
          }
          throw error
        })
      customerRecovery = thisRecovery
      customerRecoveryUid = sessionUserId
    }
    return customerRecovery
  }

  /**
   * Fetch wrapper for /customers/* endpoints that self-heals accounts whose
   * customer record was never provisioned.
   *
   * Customer creation runs after the Firebase session is established during
   * sign-in/sign-up, so an interruption (navigation, closed window, network
   * failure) can leave a permanently signed-in user without a customer
   * record. Sessions restored from persisted credentials never re-run the
   * sign-in flow, so every /customers/* request fails with 409 and nothing
   * ever retries the creation.
   *
   * On a 409 response this provisions the customer record (deduplicated
   * across concurrent callers) and retries the original request a single
   * time. If recovery fails, the original 409 response is returned so
   * callers surface their normal error handling.
   */
  /**
   * The auth middleware rejects requests for accounts without a customer
   * record using this exact message. Business-level 409s from /customers/*
   * endpoints (e.g. conflicting subscription state) must NOT trigger
   * provisioning or a blind retry of a payment request.
   */
  const MISSING_CUSTOMER_MESSAGE = 'Failed to find customer'

  const isMissingCustomerResponse = async (
    response: Response
  ): Promise<boolean> => {
    if (response.status !== 409) return false
    try {
      const body: unknown = await response.clone().json()
      return (
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        (body as { message: unknown }).message === MISSING_CUSTOMER_MESSAGE
      )
    } catch {
      return false
    }
  }

  const isCustomerEndpoint = (input: string): boolean => {
    try {
      const { pathname } = new URL(input, window.location.href)
      return pathname === '/customers' || pathname.startsWith('/customers/')
    } catch {
      return false
    }
  }

  const fetchWithCustomerRecovery = async (
    input: string,
    init?: RequestInit
  ): Promise<Response> => {
    const remintFetch = (): Promise<Response> =>
      fetchWithUnifiedRemint(
        input,
        init ?? {},
        isCloud && flags.unifiedCloudAuthEnabled
      )

    const response = await remintFetch()
    if (
      !isCustomerEndpoint(input) ||
      !(await isMissingCustomerResponse(response))
    ) {
      return response
    }

    try {
      await recoverMissingCustomer()
    } catch (error) {
      console.warn(
        'Customer provisioning during 409 recovery failed; returning original response',
        error
      )
      return response
    }

    try {
      return await remintFetch()
    } catch (error) {
      console.warn(
        'Retry after customer provisioning failed; returning original 409 response',
        error
      )
      return response
    }
  }

  const executeAuthAction = async <T>(
    action: (auth: Auth) => Promise<T>,
    options: {
      createCustomer?: boolean
      customerPayload?: Omit<CreateCustomerPayload, 'signup_source'>
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
        await createCustomer(options.customerPayload)
      }

      return result
    } finally {
      loading.value = false
    }
  }

  const login = async (
    email: string,
    password: string
  ): Promise<UserCredential> => {
    const result = await executeAuthAction(
      (authInstance) =>
        signInWithEmailAndPassword(authInstance, email, password),
      { createCustomer: true }
    )

    useTelemetry()?.trackAuth({
      method: 'email',
      is_new_user: false,
      user_id: result.user.uid,
      email: result.user.email ?? undefined,
      ...getShareAuthMetadata()
    })

    return result
  }

  const register = async (
    email: string,
    password: string,
    turnstileToken?: string
  ): Promise<UserCredential> => {
    // Drive create + customer inside one action so a failed customer step can
    // roll back the just-created Firebase user. createCustomer is where the
    // Turnstile token is validated server-side; if it fails (rejection, 5xx,
    // network) the Firebase user is already created and, without rollback, the
    // account is orphaned — every retry then fails "email already in use",
    // permanently bricking signup. Rollback is scoped to register only; login /
    // social sign-in must never delete an existing user on a customer hiccup.
    const result = await executeAuthAction(async (authInstance) => {
      const credential = await createUserWithEmailAndPassword(
        authInstance,
        email,
        password
      )
      try {
        await createCustomer(
          turnstileToken ? { turnstile_token: turnstileToken } : undefined
        )
      } catch (error) {
        // Best-effort rollback of the user created in THIS call; never let a
        // cleanup failure mask the original error.
        try {
          await credential.user.delete()
        } catch (deleteError) {
          console.warn(
            'Failed to roll back orphaned Firebase user after customer creation failed',
            deleteError
          )
        }
        throw error
      }
      return credential
    })

    useTelemetry()?.trackAuth({
      method: 'email',
      is_new_user: true,
      user_id: result.user.uid,
      email: result.user.email ?? undefined,
      ...getShareAuthMetadata()
    })

    return result
  }

  const loginWithGoogle = async (options?: {
    isNewUser?: boolean
  }): Promise<UserCredential> => {
    const result = await executeAuthAction(
      (authInstance) => signInWithPopup(authInstance, googleProvider),
      { createCustomer: true }
    )

    const additionalUserInfo = getAdditionalUserInfo(result)
    useTelemetry()?.trackAuth({
      method: 'google',
      is_new_user: options?.isNewUser || additionalUserInfo?.isNewUser || false,
      user_id: result.user.uid,
      email: result.user.email ?? undefined,
      ...getShareAuthMetadata()
    })

    return result
  }

  const loginWithGithub = async (options?: {
    isNewUser?: boolean
  }): Promise<UserCredential> => {
    const result = await executeAuthAction(
      (authInstance) => signInWithPopup(authInstance, githubProvider),
      { createCustomer: true }
    )

    const additionalUserInfo = getAdditionalUserInfo(result)
    useTelemetry()?.trackAuth({
      method: 'github',
      is_new_user: options?.isNewUser || additionalUserInfo?.isNewUser || false,
      user_id: result.user.uid,
      email: result.user.email ?? undefined,
      ...getShareAuthMetadata()
    })

    return result
  }

  const logout = async (): Promise<void> =>
    executeAuthAction((authInstance) => signOut(authInstance))

  const sendPasswordReset = async (email: string): Promise<void> =>
    executeAuthAction((authInstance) =>
      sendPasswordResetEmail(authInstance, email)
    )

  /** Update password for current user */
  const _updatePassword = async (newPassword: string): Promise<void> => {
    if (!currentUser.value) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
    await updatePassword(currentUser.value, newPassword)
  }

  const addCredits = async (
    requestBodyContent: CreditPurchasePayload
  ): Promise<CreditPurchaseResponse> => {
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    // Ensure customer was created during login/registration. Routed through
    // recoverMissingCustomer so a concurrent 409-triggered recovery and this
    // pre-flight share one POST /customers instead of racing.
    if (!customerCreated.value) {
      await recoverMissingCustomer()
    }

    const response = await fetchWithCustomerRecovery(
      buildApiUrl('/customers/credit'),
      {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBodyContent)
      }
    )

    if (!response.ok) {
      const { message } = await parseErrorResponse(response)
      throw new AuthStoreError(
        t('toastMessages.failedToInitiateCreditPurchase', {
          error: message
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
    targetTier?: BillingPortalTargetTier
  ): Promise<AccessBillingPortalResponse> => {
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    const response = await fetchWithCustomerRecovery(
      buildApiUrl('/customers/billing'),
      {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json'
        },
        ...(targetTier && {
          body: JSON.stringify({ target_tier: targetTier })
        })
      }
    )

    if (!response.ok) {
      const { message } = await parseErrorResponse(response)
      throw new AuthStoreError(
        t('toastMessages.failedToAccessBillingPortal', {
          error: message
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
    fetchWithCustomerRecovery,
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
    getAuthToken,
    notifyTokenRefreshed
  }
})
