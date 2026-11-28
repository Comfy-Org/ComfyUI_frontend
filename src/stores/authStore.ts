import { useMemoize } from '@vueuse/core'
import { FirebaseError } from 'firebase/app'
import { AuthErrorCodes, getAdditionalUserInfo } from 'firebase/auth'
import type { User, UserCredential } from 'firebase/auth'

import type { PopupSignInOptions } from '@comfyorg/account-core/firebase'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import {
  isSsoRequiredRefusal,
  ssoRequiredOrganizationId
} from '@comfyorg/account-core/sso'
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
import { partnerNodeTokens } from '@/platform/auth/partnerNode/partnerNodeTokens'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import { provideEnsureSessionCookie } from '@/platform/auth/session/sessionCookieAccess'
import type { WebSessionRequests } from '@comfyorg/api-client/webSessionFetch'
import {
  webSessionRequests,
  webSessionResourceHeader
} from '@comfyorg/api-client/webSessionFetch'
import { fetchWithUnifiedRemint } from '@/platform/auth/unified/remintRetry'
import { DISTRIBUTION, isCloud } from '@/platform/distribution/types'
import { clearOnboardingReplay } from '@/platform/onboarding/onboardingReplay'
import {
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { invalidateRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useTelemetry } from '@comfyorg/telemetry'
import { api } from '@/scripts/api'
import { useDialogService } from '@/services/dialogService'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { provideAuthStore } from '@/platform/auth/authStoreAccess'
import type { AuthTokenRequest } from '@comfyorg/api-client/apiAuthProvider'
import type { AuthHeader } from '@comfyorg/api-client/authTypes'
import type { operations } from '@/types/comfyRegistryTypes'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  fenceWorkflowStorageForAuthState,
  prepareWorkflowLogoutTransition
} from '@/platform/workflow/persistence/base/storageIO'

type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']
type CreateCustomerPayload = NonNullable<
  operations['createCustomer']['requestBody']
>['content']['application/json']
interface WorkspaceAuthContext {
  headers: AuthHeader | null
  workspaceId?: string
}

export interface SocialSignInOptions {
  readonly isNewUser?: boolean
  /** How a closed popup's late result is finished or discarded. */
  readonly popup?: PopupSignInOptions
  /** A closed popup's late credential to finish instead of opening a popup. */
  readonly resumed?: Promise<UserCredential>
}

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

/** The account belongs to an SSO organization, so it must sign in with SSO. */
export class SsoRequiredAuthError extends AuthStoreError {
  readonly organizationId: string | undefined

  constructor(organizationId: string | undefined) {
    super(t('auth.sso.required.body'), 403, 'sso_required')
    this.name = 'SsoRequiredAuthError'
    this.organizationId = organizationId
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
  const mintUnifiedToken = useMemoize((uid: string) =>
    useWorkspaceAuthStore()
      .mintAtLogin()
      .then((success) => {
        if (!success) mintUnifiedToken.delete(uid)
        return success
      })
  )

  // Token refresh trigger - increments when token is refreshed
  const tokenRefreshTrigger = ref(0)

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
      void partnerNodeTokens.revokeAll()
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
  }

  firebaseIdentity.onUserChanged((user) => {
    resetAccountState(currentUser.value?.uid ?? null, user?.uid ?? null)

    currentUser.value = user
    isInitialized.value = true
  })

  const dropDormantApiKey = (): void => {
    const apiKeyStore = useApiKeyAuthStore()
    if (apiKeyStore.getApiKey() !== null) void apiKeyStore.clearStoredApiKey()
  }

  watch(
    currentUser,
    (user, previousUser) => {
      if (isCloud && previousUser && !user) dropDormantApiKey()
    },
    { flush: 'sync' }
  )

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

  /** Bumps the token-refresh trigger after the unified refresh lifecycle mints a fresh Cloud JWT. */
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

  const getFreshFirebaseIdToken = async (): Promise<string | undefined> => {
    const user = currentUser.value
    const minted = await user?.getIdToken(true).catch((error: unknown) => {
      reportError(error, {
        surface: 'auth',
        errorType: 'auth_id_token_refresh_failed'
      })
      return undefined
    })
    if (currentUser.value?.uid !== user?.uid) return
    return minted ?? getFirebaseIdToken()
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

  const storedApiKeyAsOnlyLogin = (): AuthHeader | null =>
    isInitialized.value && currentUser.value === null
      ? useApiKeyAuthStore().getAuthHeader()
      : null

  const getUnifiedAuthHeader = async (): Promise<AuthHeader | null> => {
    if (await awaitUnifiedMint()) return null
    const token = useWorkspaceAuthStore().getUnifiedToken()
    if (token) return { Authorization: `Bearer ${token}` }
    return currentUser.value === null
      ? storedApiKeyAsOnlyLogin()
      : await getFirebaseAuthHeader()
  }

  const getAccountAuthHeader = async (): Promise<AuthHeader | null> => {
    const sessionOnly = sessionOnlyRequests()
    if (sessionOnly)
      return headerFromToken(await webSessionRunToken(sessionOnly))

    if (isCloud) return getUnifiedAuthHeader()

    if (webSessionRequests()) return getUserAuthHeader()

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
  const desktopHostTabWorkspaceId = (): string | undefined =>
    useTeamWorkspaceStore().activeWorkspaceId ??
    desktopHostUser.value?.workspaceId

  const desktopHostTabToken = async (): Promise<string | undefined> => {
    const workspaceId = desktopHostTabWorkspaceId()
    if (!workspaceId) return undefined
    const token = await desktopHostWorkspaceToken(workspaceId)
    return desktopHostTabWorkspaceId() === workspaceId ? token : undefined
  }

  const getAccountWorkspaceAuthContext = async (
    requireWorkspace: boolean
  ): Promise<WorkspaceAuthContext> => {
    const sessionOnly = sessionOnlyRequests()
    if (sessionOnly)
      return {
        headers: headerFromToken(await webSessionRunToken(sessionOnly))
      }

    if (isCloud) {
      if (await awaitUnifiedMint()) return { headers: null }
      const token = useWorkspaceAuthStore().getUnifiedToken()
      return { headers: headerFromToken(token) ?? storedApiKeyAsOnlyLogin() }
    }

    if (currentUser.value === null) {
      const apiKeyHeader = useApiKeyAuthStore().getAuthHeader()
      if (apiKeyHeader) return { headers: apiKeyHeader }
    }

    if (requireWorkspace && !(await resolveLocalWorkspace()))
      return { headers: null }
    const workspaceId = useTeamWorkspaceStore().activeWorkspaceId
    if (!workspaceId)
      return {
        headers: requireWorkspace ? null : await getFirebaseAuthHeader()
      }
    const headers =
      await useWorkspaceAuthStore().ensureWorkspaceAuthHeader(workspaceId)
    return { headers, workspaceId }
  }

  /**
   * Unified Cloud JWT token. See getAuthToken for the full priority order.
   */
  const getUnifiedAuthToken = async (): Promise<string | undefined> => {
    if (await awaitUnifiedMint()) return undefined
    return useWorkspaceAuthStore().getUnifiedToken()
  }

  const getRemintedUnifiedAuthToken = async (): Promise<string | undefined> => {
    const cached = await getUnifiedAuthToken()
    if (!cached) return undefined
    return (
      (await useWorkspaceAuthStore().remintUnifiedOnce(cached)) ?? undefined
    )
  }

  /** The raw auth token for WebSocket connections and backend node auth: the unified Cloud JWT on Cloud, else the Firebase token. */
  const getAccountAuthToken = async ({
    forceRefresh = false
  }: AuthTokenRequest = {}): Promise<string | undefined> => {
    const sessionOnly = sessionOnlyRequests()
    if (sessionOnly) return webSessionRunToken(sessionOnly)

    if (isCloud) {
      return forceRefresh
        ? getRemintedUnifiedAuthToken()
        : getUnifiedAuthToken()
    }

    return forceRefresh ? await getFreshIdToken() : await getIdToken()
  }

  /**
   * A local Firebase session resolves its workspace before its first run.
   * False when that resolution failed.
   */
  const resolveLocalWorkspace = async (): Promise<boolean> => {
    const teamWorkspaceStore = useTeamWorkspaceStore()
    const needsResolution =
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

  /** The run token for the tab's active workspace off Cloud. */
  const activeWorkspaceRunToken = async (): Promise<string | undefined> => {
    const activeWorkspaceId = useTeamWorkspaceStore().activeWorkspaceId
    if (currentUser.value && !activeWorkspaceId) return undefined
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

    if (isCloud) return useWorkspaceAuthStore().getUnifiedToken()

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
  /** An ID token minted now; the cached one when minting fails. */
  const getFreshIdToken = preferDesktopHost(
    () => desktopHostTabToken(),
    getFreshFirebaseIdToken
  )
  /** Account auth header for API requests; null when no credential is available. */
  const getAuthHeader = preferDesktopHost(
    desktopHostTabHeader,
    getAccountAuthHeader
  )
  const getWorkspaceAuthContext = async ({
    requireWorkspace = false
  }: { requireWorkspace?: boolean } = {}): Promise<WorkspaceAuthContext> => {
    if (isDesktopHostSignedIn()) {
      const workspaceId = desktopHostTabWorkspaceId()
      return { headers: await desktopHostTabHeader(), workspaceId }
    }
    return getAccountWorkspaceAuthContext(requireWorkspace)
  }
  const getWorkspaceAuthHeader = async (): Promise<AuthHeader | null> =>
    (await getWorkspaceAuthContext()).headers
  const getAuthToken = (request?: AuthTokenRequest) =>
    isDesktopHostSignedIn()
      ? desktopHostTabToken()
      : getAccountAuthToken(request)
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

  const getWorkspaceAuthTokenOrThrow = async (): Promise<string> => {
    const token = await getWorkspaceAuthToken()
    if (!token) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
    return token
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
      isCloud
    )
    if (!createCustomerRes.ok) {
      if (!completedUser) assertIdentityUnchanged(sessionIdentity)
      const refusal: unknown = await createCustomerRes
        .clone()
        .json()
        .catch(() => undefined)
      if (isSsoRequiredRefusal(createCustomerRes.status, refusal)) {
        throw new SsoRequiredAuthError(ssoRequiredOrganizationId(refusal))
      }
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
    return createCustomerResJson
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

  const revokePartnerNodeLogin = async (): Promise<void> => {
    if (isCloud || !flags.partnerNodeTokenEnabled) return
    const credential = isDesktopHostSignedIn()
      ? await desktopHostTabToken()
      : await revokingFirebaseIdToken()
    void partnerNodeTokens.revokeLogin(credential)
  }

  const revokingFirebaseIdToken = async (): Promise<string | undefined> => {
    const user = currentUser.value
    const token = await user?.getIdToken().catch(() => undefined)
    return currentUser.value?.uid === user?.uid ? token : undefined
  }

  async function logout(): Promise<void> {
    const persistenceFence = isCloud
      ? prepareWorkflowLogoutTransition()
      : undefined
    try {
      await executeAuthAction(async () => {
        await revokePartnerNodeLogin()
        const signsOutDesktopHost = isDesktopHostSignedIn()
        if (signsOutDesktopHost && !(await requestDesktopHostSignOut())) {
          throw new AuthStoreError(t('auth.desktopHost.signOutFailed'))
        }
        const storedApiKeyWouldTakeOver = isCloud || signsOutDesktopHost
        const apiKeyStore = useApiKeyAuthStore()
        if (storedApiKeyWouldTakeOver && apiKeyStore.getApiKey() !== null) {
          await apiKeyStore.clearStoredApiKey()
        }
        await useCloudWebSessionStore().signOut()
        if (currentUser.value) await firebaseIdentity.signOut()
      })
      persistenceFence?.release()
    } catch (error) {
      if (persistenceFence) {
        if (!userId.value) fenceWorkflowStorageForAuthState()
        const persistenceResumed =
          persistenceFence.releaseAndResumePersistence()
        reportError(error, {
          surface: 'auth',
          errorType: 'failure_logging_out_user',
          level: 'warning',
          tags: {
            outcome: 'degraded',
            persistence_resumed: persistenceResumed
          }
        })
      }
      throw error
    }
  }

  const sendPasswordReset = async (email: string): Promise<void> =>
    executeAuthAction(() => firebaseIdentity.sendPasswordReset(email))

  /** Update password for current user */
  const _updatePassword = async (newPassword: string): Promise<void> => {
    if (!currentUser.value) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }
    await firebaseIdentity.updatePassword(newPassword)
  }

  return {
    // State
    loading,
    currentUser,
    isInitialized,
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
    getIdToken,
    getFreshIdToken,
    loginWithGoogle,
    loginWithGithub,
    sendPasswordReset,
    updatePassword: _updatePassword,
    getAuthHeader,
    getAuthHeaderOrThrow,
    getFirebaseAuthHeader,
    getFirebaseAuthHeaderOrThrow,
    getUserAuthHeader,
    currentUserIdentity,
    getWorkspaceAuthContext,
    getWorkspaceAuthHeader,
    getWorkspaceAuthHeaderOrThrow,
    getAuthToken,
    getWorkspaceAuthToken,
    getWorkspaceAuthTokenOrThrow,
    notifyTokenRefreshed
  }
})

provideAuthStore(useAuthStore)
provideEnsureSessionCookie(async () => {
  const { useSessionCookie } =
    await import('@/platform/auth/session/useSessionCookie')
  await useSessionCookie().ensureSessionCookie()
})
