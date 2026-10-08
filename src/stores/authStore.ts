import { useMemoize } from '@vueuse/core'
import { FirebaseError } from 'firebase/app'
import { AuthErrorCodes, getAdditionalUserInfo } from 'firebase/auth'
import type { User, UserCredential } from 'firebase/auth'

import type { PopupSignInOptions } from '@comfyorg/account-core/firebase'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { fetchWithCustomerRecovery as fetchHealingMissingCustomer } from '@comfyorg/account-core/customerRecovery'
import {
  signUpWithProvisioning,
  socialSignInWithProvisioning
} from '@comfyorg/account-core/provisioning'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import {
  desktopHostUser,
  desktopHostWorkspaceToken,
  isDesktopHostSignedIn,
  requestDesktopHostSignOut
} from '@/platform/auth/desktopHost/desktopHostSession'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import type { WebSessionRequests } from '@/platform/auth/session/webSessionFetch'
import {
  webSessionRequests,
  webSessionResourceHeader
} from '@/platform/auth/session/webSessionFetch'
import { fetchWithUnifiedRemint } from '@/platform/auth/unified/remintRetry'
import { DISTRIBUTION, isCloud } from '@/platform/distribution/types'
import { clearOnboardingReplay } from '@/platform/onboarding/onboardingReplay'
import {
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { invalidateRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { reportError } from '@/platform/telemetry/reportError'
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
export interface SocialSignInOptions {
  readonly isNewUser?: boolean
  /** How a closed popup's late result is finished or discarded. */
  readonly popup?: PopupSignInOptions
  /** A closed popup's late credential to finish instead of opening a popup. */
  readonly resumed?: Promise<UserCredential>
}

export type BillingPortalTargetTier = NonNullable<
  NonNullable<
    NonNullable<AccessBillingPortalReqBody>['content']
  >['application/json']
>['target_tier']

/** `AuthStoreError.code` for a `/customers/*` call skipped because the account has no personal workspace. */
export const NO_PERSONAL_WORKSPACE = 'no_personal_workspace'

export class AuthStoreError extends Error {
  readonly status: number | undefined
  readonly code: string | undefined

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'AuthStoreError'
    this.status = status
    this.code = code
  }
}

const SSO_SIGN_IN_PROVIDERS: ReadonlySet<string> = new Set([
  'saml.workos',
  'oidc.workos'
])

async function webSessionRunToken(
  requests: WebSessionRequests
): Promise<string | undefined> {
  const scope = await requests.scope()
  if (!scope) return undefined
  const result = await requests.workspaceToken(scope)
  if (result.status === 'ok') return result.credential.token
  if (result.httpStatus !== 401) {
    reportError(new Error(`Run token mint failed: ${result.code}`), {
      surface: 'auth',
      errorType: 'web_session_run_token_failure',
      level: 'warning',
      tags: { failure_code: result.code, http_status: result.httpStatus ?? 0 }
    })
  }
  return undefined
}

export const useAuthStore = defineStore('auth', () => {
  const { flags } = useFeatureFlags()
  const cloudWebSessionStore = useCloudWebSessionStore()

  // State
  const loading = ref(false)
  const currentUser = ref<User | null>(null)
  const isInitialized = ref(false)
  const customerProvisionedIdentity = ref<string | null>(null)
  /**
   * Memoizes the in-flight or successful customer provisioning attempt for
   * the current account (see recoverMissingCustomer). Declared here so the
   * auth-state listener below can reset it before its initializer would
   * otherwise run.
   */
  let customerRecovery: Promise<void> | null = null
  let customerRecoveryIdentity: string | null = null
  const isFetchingBalance = ref(false)
  const mintUnifiedToken = useMemoize((uid: string) =>
    useWorkspaceAuthStore()
      .mintAtLogin()
      .then((success) => {
        if (!success) mintUnifiedToken.delete(uid)
        return success
      })
  )

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

  // Getters
  const sessionUser = computed(() => cloudWebSessionStore.signedInUser)
  const isAuthenticated = computed(
    () => isDesktopHostSignedIn() || !!currentUser.value || !!sessionUser.value
  )
  const userEmail = computed(() =>
    isDesktopHostSignedIn()
      ? desktopHostUser.value?.email
      : (sessionUser.value?.email ?? currentUser.value?.email)
  )
  const userId = computed(() =>
    isDesktopHostSignedIn()
      ? desktopHostUser.value?.id
      : (sessionUser.value?.id ?? currentUser.value?.uid)
  )
  /** False only when SSO is on and the session says there is no personal workspace. */
  const hasPersonalWorkspace = computed(
    () =>
      !(flags.ssoEnabled && sessionUser.value?.hasPersonalWorkspace === false)
  )

  const assertHasPersonalWorkspace = (): void => {
    if (!hasPersonalWorkspace.value) {
      throw new AuthStoreError(
        t('toastMessages.noPersonalWorkspace'),
        undefined,
        NO_PERSONAL_WORKSPACE
      )
    }
  }
  /** With SSO on, the session's user when no Firebase user signed this tab in. */
  const sessionOnlyUser = computed(() =>
    flags.ssoEnabled && currentUser.value === null
      ? sessionUser.value
      : undefined
  )
  /** With SSO on, whether the server says the session signed in through SSO. */
  const signedInWithSso = computed(
    () =>
      flags.ssoEnabled &&
      SSO_SIGN_IN_PROVIDERS.has(sessionUser.value?.signInProvider ?? '')
  )
  const sessionOnlyRequests = (): WebSessionRequests | undefined =>
    sessionOnlyUser.value ? webSessionRequests() : undefined

  function getShareAuthMetadata() {
    const shareId = getPreservedQueryParam(
      PRESERVED_QUERY_NAMESPACES.SHARE_AUTH,
      'share'
    )
    if (shareId) clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.SHARE_AUTH)
    return shareId ? { share_id: shareId } : {}
  }

  /**
   * Drops the previous account's state when the signed-in identity changes
   * or signs out, whichever source (Firebase or the Desktop host) changed it.
   */
  const resetAccountState = (
    previousUserId: string | null,
    nextUserId: string | null
  ): void => {
    const identityChanged =
      previousUserId !== null && previousUserId !== nextUserId

    if (nextUserId === null || identityChanged) {
      useWorkspaceAuthStore().clearWorkspaceContext()
      mintUnifiedToken.clear()
    }
    if (identityChanged) {
      clearOnboardingReplay(previousUserId)
      useTeamWorkspaceStore().resetForIdentityChange()
      invalidateRemoteConfig()
    }

    // A direct account switch (A -> B, or sign-out) must re-handshake the
    // realtime socket so a tab stops receiving the previous account's live
    // events. The initial connect is owned by api.init(), so only react once an
    // identity has been recorded (`identityChanged` is false on first sign-in).
    if (isCloud && identityChanged) {
      void api.resetSocket()
    }

    // Reset balance when auth state changes
    balance.value = null
    lastBalanceUpdateTime.value = null

    // Customer provisioning state is per-account: without this reset, a
    // second account in the same browser session would be short-circuited by
    // the previous account's memoized recovery and stay stuck on 409s.
    customerProvisionedIdentity.value = null
    customerRecovery = null
    customerRecoveryIdentity = null
  }

  firebaseIdentity.onUserChanged((user) => {
    resetAccountState(currentUser.value?.uid ?? null, user?.uid ?? null)

    currentUser.value = user
    isInitialized.value = true
    if (user === null) {
      lastTokenUserId.value = null
    } else if (isCloud && !flags.unifiedWebSessionEnabled) {
      // Mint the single Cloud JWT at login (flag-guarded inside the store; a
      // no-op when unified_cloud_auth is off). With the web session on, this
      // runs before the router decides the session, so WorkspaceAuthGate
      // mints instead, and only for a tab the session did not sign in.
      void mintUnifiedToken(user.uid)
    }
  })

  watch(
    () => desktopHostUser.value?.id ?? null,
    (nextUserId, previousUserId) =>
      resetAccountState(previousUserId, nextUserId)
  )

  // Off Cloud, nothing else loads a host account's workspaces before the
  // account menu needs them, including a Desktop sign-in that predates this
  // store. A store already loaded for the Firebase or API-key account is
  // dropped first, since Desktop now owns the credential.
  watch(
    () => desktopHostUser.value?.id ?? null,
    (userId, previousUserId) => {
      if (userId === null || isCloud) return
      const teamWorkspaceStore = useTeamWorkspaceStore()
      if (
        previousUserId == null &&
        teamWorkspaceStore.initState !== 'uninitialized'
      ) {
        useWorkspaceAuthStore().clearWorkspaceContext()
        teamWorkspaceStore.resetForIdentityChange()
      }
      teamWorkspaceStore.initialize().catch(() => undefined)
    },
    { immediate: true }
  )

  // Listen for token refresh events
  firebaseIdentity.onTokenChanged((user) => {
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

  /**
   * While Desktop shares its session, every credential comes from Desktop;
   * otherwise the existing Firebase / web-session / API-key paths answer.
   */
  const preferDesktopHost =
    <T>(fromHost: () => Promise<T>, otherwise: () => Promise<T>) =>
    (): Promise<T> =>
      isDesktopHostSignedIn() ? fromHost() : otherwise()
  const desktopHostTabHeader = async (): Promise<AuthHeader | null> =>
    headerFromToken(await desktopHostTabToken())

  const getFirebaseIdToken = async (): Promise<string | undefined> => {
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
   * Awaits any in-flight unified-auth login mint for the current identity.
   * The wait can outlast an account switch, so callers must treat a `true`
   * result (identity changed while waiting) as stale and not read the new
   * identity's unified token or fall back to its Firebase token.
   */
  const awaitUnifiedMint = async (): Promise<boolean> => {
    const uid = currentUser.value?.uid
    if (uid) await mintUnifiedToken(uid).catch(() => false)
    return currentUser.value?.uid !== uid
  }

  /**
   * Unified Cloud JWT header, falling back to the Firebase token when minting
   * failed. See getAuthHeader for the full priority order.
   */
  const getUnifiedAuthHeader = async (): Promise<AuthHeader | null> => {
    if (await awaitUnifiedMint()) return null
    const token = useWorkspaceAuthStore().getUnifiedToken()
    if (token) return { Authorization: `Bearer ${token}` }
    return await getFirebaseAuthHeader()
  }

  /**
   * Retrieves the appropriate authentication header for API requests.
   *
   * When unified_cloud_auth is enabled, awaits any in-flight login mint and
   * returns the single Cloud JWT; if minting failed, falls back to the
   * Firebase token rather than reporting an authenticated user as logged out.
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
  const getAccountAuthHeader = async (): Promise<AuthHeader | null> => {
    const sessionOnly = sessionOnlyRequests()
    if (sessionOnly)
      return headerFromToken(await webSessionRunToken(sessionOnly))

    if (flags.unifiedCloudAuthEnabled) return getUnifiedAuthHeader()

    if (webSessionRequests()) return getUserAuthHeader()

    const workspaceAuth = useWorkspaceAuthStore()
    const activeWorkspaceId = useTeamWorkspaceStore().activeWorkspaceId

    if (isCloud && activeWorkspaceId) {
      return workspaceAuth.ensureWorkspaceAuthHeader(activeWorkspaceId)
    }

    if (isCloud) {
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
  const headerFromToken = (token: string | undefined): AuthHeader | null =>
    token ? { Authorization: `Bearer ${token}` } : null
  const getFirebaseAuthHeader = async (): Promise<AuthHeader | null> =>
    headerFromToken(await getIdToken())

  /**
   * Returns the user-identity auth header for user-scoped endpoints
   * (e.g., /customers/*): the Firebase token for signed-in sessions, the
   * stored API key for API-key sessions. Never a workspace-scoped token.
   */
  const getUserAuthHeader = async (): Promise<AuthHeader | null> =>
    currentUser.value === null && !isDesktopHostSignedIn()
      ? useApiKeyAuthStore().getAuthHeader()
      : await getFirebaseAuthHeader()

  const getCustomerAuthHeader = async (): Promise<Readonly<
    Record<string, string>
  > | null> => (await webSessionResourceHeader()) ?? (await getUserAuthHeader())

  const currentUserIdentity = (): string | null =>
    isDesktopHostSignedIn()
      ? (desktopHostUser.value?.id ?? null)
      : (sessionUser.value?.id ??
        currentUser.value?.uid ??
        useApiKeyAuthStore().getApiKey())

  const currentUserCredentialIdentity = (): string | null =>
    currentUser.value?.uid ?? useApiKeyAuthStore().getApiKey()

  /**
   * Response data from a user-scoped endpoint belongs to the identity that
   * asked for it. A 200 bypasses the recovery guards in
   * fetchWithCustomerRecovery, which only fence the missing-customer retry, so
   * a credential swap while the request was in flight would hand the previous
   * account's data to the current session — a Stripe portal or checkout URL
   * minted for A opening inside B.
   */
  const assertIdentityUnchanged = (requestOwner: string | null): void => {
    if (currentUserIdentity() !== requestOwner) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
  }

  /**
   * Desktop's credential, always requested for an explicit workspace: the
   * tab's active workspace, else the one Desktop's session reports. Desktop
   * releases nothing on a mismatch, and with neither there is no credential.
   */
  const desktopHostTabToken = async (): Promise<string | undefined> => {
    const tabWorkspaceId = (): string | undefined =>
      useTeamWorkspaceStore().activeWorkspaceId ??
      desktopHostUser.value?.workspaceId
    const workspaceId = tabWorkspaceId()
    if (!workspaceId) return undefined
    const token = await desktopHostWorkspaceToken(workspaceId)
    return tabWorkspaceId() === workspaceId ? token : undefined
  }

  /**
   * Returns the workspace-scoped auth header. An API-key session has no
   * Firebase token to exchange for a workspace token; the key itself is the
   * workspace credential (the server resolves the key's bound workspace), so
   * it is sent directly instead of minting a token.
   */
  const getAccountWorkspaceAuthHeader =
    async (): Promise<AuthHeader | null> => {
      const sessionOnly = sessionOnlyRequests()
      if (sessionOnly)
        return headerFromToken(await webSessionRunToken(sessionOnly))

      if (flags.unifiedCloudAuthEnabled) {
        if (await awaitUnifiedMint()) return null
        const token = useWorkspaceAuthStore().getUnifiedToken()
        return token ? { Authorization: `Bearer ${token}` } : null
      }

      if (currentUser.value === null) {
        const apiKeyHeader = useApiKeyAuthStore().getAuthHeader()
        if (apiKeyHeader) return apiKeyHeader
      }

      const activeWorkspaceId = useTeamWorkspaceStore().activeWorkspaceId
      if (!activeWorkspaceId) return getFirebaseAuthHeader()
      return useWorkspaceAuthStore().ensureWorkspaceAuthHeader(
        activeWorkspaceId
      )
    }

  /**
   * Unified Cloud JWT token. See getAuthToken for the full priority order.
   */
  const getUnifiedAuthToken = async (): Promise<string | undefined> => {
    if (await awaitUnifiedMint()) return undefined
    return useWorkspaceAuthStore().getUnifiedToken()
  }

  /**
   * Returns the raw auth token (not wrapped in a header object).
   * When unified_cloud_auth is enabled, awaits any in-flight login mint and
   * returns the single Cloud JWT; otherwise Cloud priority is workspace token
   * > Firebase token.
   * Use this for WebSocket connections and backend node auth.
   */
  const getAccountAuthToken = async (): Promise<string | undefined> => {
    const sessionOnly = sessionOnlyRequests()
    if (sessionOnly) return webSessionRunToken(sessionOnly)

    if (flags.unifiedCloudAuthEnabled) return getUnifiedAuthToken()

    const workspaceAuth = useWorkspaceAuthStore()
    const activeWorkspaceId = useTeamWorkspaceStore().activeWorkspaceId

    if (isCloud && activeWorkspaceId) {
      return (
        (await workspaceAuth.ensureWorkspaceToken(activeWorkspaceId)) ??
        undefined
      )
    }

    if (isCloud) {
      const wsToken = workspaceAuth.getWorkspaceToken()
      if (wsToken) return wsToken
    }

    return await getIdToken()
  }

  /**
   * A local Firebase session resolves its workspace before its first run.
   * False when that resolution failed.
   */
  const resolveLocalWorkspace = async (): Promise<boolean> => {
    const teamWorkspaceStore = useTeamWorkspaceStore()
    const needsResolution =
      !isCloud &&
      currentUser.value !== null &&
      !teamWorkspaceStore.activeWorkspaceId &&
      teamWorkspaceStore.initState !== 'ready'
    if (!needsResolution) return true
    try {
      await teamWorkspaceStore.initialize()
      return true
    } catch {
      return false
    }
  }

  /** The run token for the tab's active workspace, per distribution. */
  const activeWorkspaceRunToken = async (): Promise<string | undefined> => {
    const activeWorkspaceId = useTeamWorkspaceStore().activeWorkspaceId
    if (!isCloud && currentUser.value && !activeWorkspaceId) return undefined
    if (!activeWorkspaceId) return (await getIdToken()) ?? undefined
    return (
      (await useWorkspaceAuthStore().ensureWorkspaceToken(activeWorkspaceId)) ??
      undefined
    )
  }

  const getAccountWorkspaceAuthToken = async (): Promise<
    string | undefined
  > => {
    const requests = webSessionRequests()
    if (requests) return webSessionRunToken(requests)

    if (flags.unifiedCloudAuthEnabled) {
      return useWorkspaceAuthStore().getUnifiedToken()
    }

    if (currentUser.value === null && useApiKeyAuthStore().isAuthenticated) {
      return undefined
    }

    if (!(await resolveLocalWorkspace())) return undefined

    return activeWorkspaceRunToken()
  }

  const getIdToken = preferDesktopHost(
    () => desktopHostTabToken(),
    getFirebaseIdToken
  )
  const getAuthHeader = preferDesktopHost(
    desktopHostTabHeader,
    getAccountAuthHeader
  )
  const getWorkspaceAuthHeader = preferDesktopHost(
    desktopHostTabHeader,
    getAccountWorkspaceAuthHeader
  )
  const getAuthToken = preferDesktopHost(
    () => desktopHostTabToken(),
    getAccountAuthToken
  )
  const getWorkspaceAuthToken = preferDesktopHost(
    () => desktopHostTabToken(),
    getAccountWorkspaceAuthToken
  )

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

  const getWorkspaceAuthHeaderOrThrow = async (): Promise<AuthHeader> => {
    const authHeader = await getWorkspaceAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
    return authHeader
  }

  const fetchBalance = async (): Promise<GetCustomerBalanceResponse | null> => {
    if (!hasPersonalWorkspace.value) return null
    isFetchingBalance.value = true
    const requestOwner = currentUserIdentity()
    const requestCredential = currentUserCredentialIdentity()
    const requestIsCurrent = () =>
      currentUserIdentity() === requestOwner &&
      currentUserCredentialIdentity() === requestCredential
    try {
      const authHeader = await getCustomerAuthHeader()
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
        if (!requestIsCurrent()) {
          return null
        }
        throw new AuthStoreError(
          t('toastMessages.failedToFetchBalance', {
            error: message
          })
        )
      }

      const balanceData = await response.json()
      // Session identity and request credentials can change independently;
      // a late response must still match both.
      if (!requestIsCurrent()) {
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
    payload?: Omit<CreateCustomerPayload, 'signup_source'>,
    completedCredential?: UserCredential
  ): Promise<CreateCustomerResponse> => {
    // Pin provisioning to the completed credential: a concurrent auth switch
    // must not let us provision (or roll back) a different account.
    const completedUser = completedCredential?.user
    if (!completedUser) assertHasPersonalWorkspace()
    const sessionIdentity = completedUser?.uid ?? currentUserIdentity()
    const authHeader = completedUser
      ? headerFromToken(await completedUser.getIdToken())
      : await getCustomerAuthHeader()
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
      if (!completedUser) assertIdentityUnchanged(sessionIdentity)
      throw new AuthStoreError(
        t('toastMessages.failedToCreateCustomer', {
          error: createCustomerRes.statusText
        }),
        createCustomerRes.status
      )
    }

    const createCustomerResJson: CreateCustomerResponse =
      await createCustomerRes.json()
    if (!createCustomerResJson.id) {
      throw new AuthStoreError(
        t('toastMessages.failedToCreateCustomer', {
          error: 'No customer ID returned'
        })
      )
    }

    if (!completedUser) assertIdentityUnchanged(sessionIdentity)
    if (sessionIdentity !== null) {
      customerProvisionedIdentity.value = sessionIdentity
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
    const sessionIdentity = currentUserIdentity()
    if (
      customerRecovery === null ||
      customerRecoveryIdentity !== sessionIdentity
    ) {
      const thisRecovery: Promise<void> = createCustomer()
        .then(() => undefined)
        .catch((error: unknown) => {
          if (customerRecovery === thisRecovery) {
            customerRecovery = null
            customerRecoveryIdentity = null
          }
          throw error
        })
      customerRecovery = thisRecovery
      customerRecoveryIdentity = sessionIdentity
    }
    return customerRecovery
  }

  /** /customers/* fetch that self-heals a never-provisioned account (rule in @comfyorg/account-core). */
  const fetchWithCustomerRecovery = async (
    input: string,
    init?: RequestInit
  ): Promise<Response> => {
    assertHasPersonalWorkspace()
    const requestOwner = currentUserIdentity()
    return fetchHealingMissingCustomer(input, {
      request: () =>
        fetchWithUnifiedRemint(
          input,
          init ?? {},
          isCloud && flags.unifiedCloudAuthEnabled
        ),
      recoverMissingCustomer,
      identityUnchanged: () => currentUserIdentity() === requestOwner,
      base: window.location.href
    })
  }

  const executeAuthAction = async <T>(
    action: () => Promise<T>,
    options: {
      createCustomer?: boolean
      customerPayload?: Omit<CreateCustomerPayload, 'signup_source'>
    } = {}
  ): Promise<T> => {
    loading.value = true

    try {
      const result = await action()

      if (options.createCustomer) {
        await provisionCustomerForSignedInUser(options.customerPayload)
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
      () => firebaseIdentity.signInWithEmail(email, password),
      { createCustomer: true }
    )

    useCloudWebSessionStore().signedInInteractively(result.user)
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
    const result = await executeAuthAction(() =>
      signUpWithProvisioning({
        createUser: () => firebaseIdentity.createUserWithEmail(email, password),
        provisionCustomer: (credential) =>
          createCustomer(
            turnstileToken ? { turnstile_token: turnstileToken } : undefined,
            credential
          ),
        onRollbackFailure: (error) => {
          reportError(error, {
            surface: 'auth',
            errorType: 'auth_signup_rollback_failed'
          })
          console.warn(
            'Failed to roll back orphaned Firebase user after customer creation failed',
            error
          )
        }
      })
    )

    useCloudWebSessionStore().signedInInteractively(result.user)
    useTelemetry()?.trackAuth({
      method: 'email',
      is_new_user: true,
      user_id: result.user.uid,
      email: result.user.email ?? undefined,
      ...getShareAuthMetadata()
    })

    return result
  }

  // Provisioning is gated on a mintable ID token: getIdToken surfaces a
  // token-mint failure (dialog + report) and the record is never attempted
  // without the token it would need anyway.
  const provisionCustomerForSignedInUser = async (
    payload?: Omit<CreateCustomerPayload, 'signup_source'>,
    completedCredential?: UserCredential
  ): Promise<void> => {
    const token = completedCredential
      ? await completedCredential.user.getIdToken()
      : await getIdToken()
    if (!token) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
    await createCustomer(payload, completedCredential)
  }

  const loginWithGoogle = async (
    options?: SocialSignInOptions
  ): Promise<UserCredential> => {
    const result = await executeAuthAction(() =>
      socialSignInWithProvisioning({
        signIn: () =>
          options?.resumed ?? firebaseIdentity.signInWithGoogle(options?.popup),
        provisionCustomer: (credential) =>
          provisionCustomerForSignedInUser(undefined, credential)
      })
    )

    const additionalUserInfo = getAdditionalUserInfo(result)
    useCloudWebSessionStore().signedInInteractively(result.user)
    useTelemetry()?.trackAuth({
      method: 'google',
      is_new_user: options?.isNewUser || additionalUserInfo?.isNewUser || false,
      user_id: result.user.uid,
      email: result.user.email ?? undefined,
      ...getShareAuthMetadata()
    })

    return result
  }

  const loginWithGithub = async (
    options?: SocialSignInOptions
  ): Promise<UserCredential> => {
    const result = await executeAuthAction(() =>
      socialSignInWithProvisioning({
        signIn: () =>
          options?.resumed ?? firebaseIdentity.signInWithGitHub(options?.popup),
        provisionCustomer: (credential) =>
          provisionCustomerForSignedInUser(undefined, credential)
      })
    )

    const additionalUserInfo = getAdditionalUserInfo(result)
    useCloudWebSessionStore().signedInInteractively(result.user)
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
    executeAuthAction(async () => {
      const signsOutDesktopHost = isDesktopHostSignedIn()
      if (signsOutDesktopHost && !(await requestDesktopHostSignOut())) {
        throw new AuthStoreError(t('auth.desktopHost.signOutFailed'))
      }
      // Local and Desktop keep the key: partner nodes run on it. A Desktop
      // host logout drops it, or an earlier session's key would take over.
      const dropsStoredApiKey =
        signsOutDesktopHost ||
        (flags.ssoEnabled && flags.unifiedWebSessionEnabled)
      await useCloudWebSessionStore().signOut()
      if (currentUser.value) await firebaseIdentity.signOut()
      const apiKeyStore = useApiKeyAuthStore()
      if (dropsStoredApiKey && apiKeyStore.getApiKey() !== null) {
        await apiKeyStore.clearStoredApiKey()
      }
    })

  const sendPasswordReset = async (email: string): Promise<void> =>
    executeAuthAction(() => firebaseIdentity.sendPasswordReset(email))

  /** Update password for current user */
  const _updatePassword = async (newPassword: string): Promise<void> => {
    if (!currentUser.value) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
    await firebaseIdentity.updatePassword(newPassword)
  }

  const addCredits = async (
    requestBodyContent: CreditPurchasePayload
  ): Promise<CreditPurchaseResponse> => {
    const requestOwner = currentUserIdentity()
    const authHeader = await getCustomerAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    // Ensure customer was created during login/registration. Routed through
    // recoverMissingCustomer so a concurrent 409-triggered recovery and this
    // pre-flight share one POST /customers instead of racing.
    if (customerProvisionedIdentity.value !== requestOwner) {
      await recoverMissingCustomer()
      if (currentUserIdentity() !== requestOwner) {
        throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
      }
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
      const { message, code } = await parseErrorResponse(response)
      assertIdentityUnchanged(requestOwner)
      throw new AuthStoreError(
        t('toastMessages.failedToInitiateCreditPurchase', {
          error: message
        }),
        response.status,
        code
      )
    }

    const creditPurchase: CreditPurchaseResponse = await response.json()
    assertIdentityUnchanged(requestOwner)
    return creditPurchase
  }

  const initiateCreditPurchase = async (
    requestBodyContent: CreditPurchasePayload
  ): Promise<CreditPurchaseResponse> =>
    executeAuthAction(() => addCredits(requestBodyContent))

  const accessBillingPortal = async (
    targetTier?: BillingPortalTargetTier,
    options?: { cancelSubscription?: boolean }
  ): Promise<AccessBillingPortalResponse> => {
    if (targetTier && options?.cancelSubscription) {
      throw new AuthStoreError(
        'cancelSubscription cannot be combined with a target tier'
      )
    }
    const requestOwner = currentUserIdentity()
    const authHeader = await getCustomerAuthHeader()
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
        }),
        ...(options?.cancelSubscription === true && {
          body: JSON.stringify({ cancel_subscription: true })
        })
      }
    )

    if (!response.ok) {
      const { message, code } = await parseErrorResponse(response)
      assertIdentityUnchanged(requestOwner)
      throw new AuthStoreError(
        t('toastMessages.failedToAccessBillingPortal', {
          error: message
        }),
        response.status,
        code
      )
    }

    const billingPortal: AccessBillingPortalResponse = await response.json()
    assertIdentityUnchanged(requestOwner)
    return billingPortal
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
    sessionUser,
    hasPersonalWorkspace,
    sessionOnlyUser,
    signedInWithSso,
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
    getUserAuthHeader,
    currentUserIdentity,
    getWorkspaceAuthHeader,
    getWorkspaceAuthHeaderOrThrow,
    getAuthToken,
    getWorkspaceAuthToken,
    notifyTokenRefreshed
  }
})
