import type { User } from 'firebase/auth'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import type {
  ScheduledRefreshReport,
  SessionErrorCode
} from '@comfyorg/account-core/session'
import { createWebCrossTabRefreshPort } from '@comfyorg/account-core/web'
import {
  SESSION_ERROR_CODES,
  createSessionClient,
  isPermanentSessionError
} from '@comfyorg/account-core/session'

import { t } from '@/i18n'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useTelemetry } from '@/platform/telemetry'
import type { UnifiedAuthRefreshOutcome } from '@/platform/telemetry/types'
import { prepareWorkflowWorkspaceTransition } from '@/platform/workflow/persistence/base/storageIO'
import {
  MAX_SCHEDULED_REFRESH_RETRIES,
  TOKEN_REFRESH_BUFFER_MS,
  WORKSPACE_STORAGE_KEYS
} from '@/platform/workspace/workspaceConstants'
import { createLegacyWorkspaceTokenRail } from '@/platform/workspace/stores/legacyWorkspaceTokenRail'
import type { WorkspaceTokenResponse } from '@/platform/workspace/stores/legacyWorkspaceTokenRail'
import { WorkspaceAuthError } from '@/platform/workspace/stores/workspaceAuthError'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAuthStore } from '@/stores/authStore'
import type { WorkspaceIdentity } from '@/platform/workspace/workspaceTypes'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { workspaceApiUrl } from '@/platform/workspace/api/workspaceApiUrl'

export { WorkspaceAuthError }
// The e2e fixtures import this type from the store path.
export type { WorkspaceTokenResponse }

const UNIFIED_REFRESH_RETRY_BASE_MS = 5000
/** Ceiling on waiting for the identity port before a host mint gives up. */
export const UNIFIED_IDENTITY_SETTLE_TIMEOUT_MS = 15_000

// Retain expired unified-token contexts briefly so a concurrent reactive-401
// replay for the just-rotated token still resolves, then evict them so a
// long-lived session cannot grow the context Map unbounded.
const ISSUED_TOKEN_CONTEXT_GRACE_MS = 5 * 60 * 1000

// Exhaustive switch and locale-shaped return: an unmapped code and a renamed
// key are both compile errors here.
type WorkspaceAuthErrorMessageKey =
  `workspaceAuth.errors.${keyof (typeof enMessages)['workspaceAuth']['errors']}`

function isSessionErrorCode(
  code: string | undefined
): code is SessionErrorCode {
  return code !== undefined && code in SESSION_ERROR_CODES
}

function sessionErrorMessageKey(
  code: SessionErrorCode
): WorkspaceAuthErrorMessageKey {
  switch (code) {
    case 'ACCESS_DENIED':
      return 'workspaceAuth.errors.accessDenied'
    case 'WORKSPACE_NOT_FOUND':
      return 'workspaceAuth.errors.workspaceNotFound'
    case 'INVALID_FIREBASE_TOKEN':
      return 'workspaceAuth.errors.invalidFirebaseToken'
    case 'NOT_AUTHENTICATED':
      return 'workspaceAuth.errors.notAuthenticated'
    case 'TOKEN_EXCHANGE_FAILED':
      return 'workspaceAuth.errors.tokenExchangeFailed'
  }
}

// Workspace auth has no Firebase fallback, so surface permanent failures.
function surfacePermanentAuthError(err: WorkspaceAuthError): void {
  console.error('Unified workspace auth revoked or invalid:', err)
  useToastStore().add({
    severity: 'error',
    summary: t('g.error'),
    detail: t(
      sessionErrorMessageKey(
        isSessionErrorCode(err.code) ? err.code : 'TOKEN_EXCHANGE_FAILED'
      )
    )
  })
}

export const useWorkspaceAuthStore = defineStore('workspaceAuth', () => {
  const { flags } = useFeatureFlags()
  // Read fresh after an await: the reactive flag can flip mid-mint, and a
  // captured read is narrowed to the value at the function's opening guard.
  const unifiedRailEnabled = () => flags.unifiedCloudAuthEnabled

  // State
  const currentWorkspace = shallowRef<WorkspaceIdentity | null>(null)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  // Unified Cloud-JWT slot (flag-gated: unified_cloud_auth). Kept separate from
  // workspaceToken so the legacy and unified refresh lifecycles cannot collide.
  const unifiedToken = ref<string | null>(null)
  const unifiedTokenOwnerUid = ref<string | null>(null)
  const issuedUnifiedTokenContexts = new Map<
    string,
    { ownerUid: string; targetKey: string; expiresAt: number }
  >()

  const {
    workspaceToken,
    initializeFromSession,
    switchLegacyWorkspace,
    refreshToken,
    ensureWorkspaceToken,
    ensureWorkspaceAuthHeader,
    getWorkspaceAuthHeader,
    getWorkspaceToken,
    hasValidWorkspaceToken,
    retireLegacyToken,
    stopRefreshTimer,
    clearLegacyContext
  } = createLegacyWorkspaceTokenRail({
    currentWorkspace,
    isLoading,
    error,
    currentUserUid,
    isCurrentUser,
    getIdToken: () => useAuthStore().getIdToken(),
    hasSignedInUser: () => useAuthStore().currentUser !== null,
    activeWorkspaceId: () => useTeamWorkspaceStore().activeWorkspaceId,
    switchWorkspace,
    endWorkspaceSession,
    persistWorkspaceIdentity,
    clearSessionStorage,
    surfacePermanentAuthError
  })

  // Getters
  const isAuthenticated = computed(
    () => currentWorkspace.value !== null && hasValidWorkspaceToken()
  )

  function currentUserUid(): string | null {
    return useAuthStore().currentUser?.uid ?? null
  }

  function isCurrentUser(ownerUid: string): boolean {
    return currentUserUid() === ownerUid
  }

  function persistWorkspaceIdentity(workspace: WorkspaceIdentity): void {
    try {
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify(workspace)
      )
    } catch {
      console.warn('Failed to persist workspace identity to sessionStorage')
    }
  }

  function clearSessionStorage(): void {
    try {
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.TOKEN)
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.OWNER_UID)
    } catch {
      console.warn('Failed to clear workspace context from sessionStorage')
    }
  }

  // Actions
  function init(): void {
    initializeFromSession()
  }

  function destroy(): void {
    stopRefreshTimer()
    stopUnifiedFlagWatch()
    unifiedSessionClient.dispose()
    clearUnifiedContext()
    stopUnifiedSnapshot()
  }

  function switchWorkspace(workspaceId: string): Promise<void> {
    if (flags.unifiedCloudAuthEnabled) {
      return switchUnifiedWorkspace(workspaceId)
    }

    return switchLegacyWorkspace(workspaceId)
  }

  // --- Unified Cloud-JWT lifecycle (flag-gated: unified_cloud_auth) ----------
  //
  // The mint/refresh machinery is delegated to @comfyorg/account-core's session
  // client (its scheduler runs the proactive chain; reactive 401 re-mints
  // recover API traffic, and the proactive chain keeps cookie-authenticated
  // <img>/media loads alive past the session cookie expiry, FE-1595). This
  // store keeps the host policies: telemetry, toasts, cookie rotation, the
  // issued-token grace map, and teardown.

  // Mint body the unified session re-mints against: `{}` = personal (resolved
  // server-side from the Firebase identity), `{ workspace_id }` = explicit.
  type UnifiedMintBody = Record<string, never> | { workspace_id: string }

  let unifiedTarget: UnifiedMintBody | null = null
  let unifiedScheduledRetryCount = 0
  let unifiedPermanentFailureSurfaced = false

  function personalWorkspaceTarget(): UnifiedMintBody {
    return {}
  }

  function currentUnifiedTarget(): UnifiedMintBody | null {
    return unifiedTarget
  }

  function unifiedTargetKey(target: UnifiedMintBody): string {
    return 'workspace_id' in target ? target.workspace_id : 'personal'
  }

  function unifiedWorkspaceIdFor(target: UnifiedMintBody): string | undefined {
    return 'workspace_id' in target ? target.workspace_id : undefined
  }

  function getUnifiedSessionClient() {
    return unifiedSessionClient
  }

  // The session client caches per mint target, so a transport minting for any
  // other target than this store's would re-mint on every request.
  function getUnifiedMintWorkspaceId(): string | undefined {
    return unifiedTarget ? unifiedWorkspaceIdFor(unifiedTarget) : undefined
  }

  function unifiedSelectionInvalid(code: SessionErrorCode): boolean {
    return code === 'ACCESS_DENIED' || code === 'WORKSPACE_NOT_FOUND'
  }

  // Guard the toast on a one-shot flag reset by the next successful mint, so
  // concurrent permanent failures across the proactive + reactive paths alarm
  // the user once, not once per caller.
  function surfaceUnifiedPermanentFailure(code: SessionErrorCode): void {
    if (unifiedPermanentFailureSurfaced) return
    unifiedPermanentFailureSurfaced = true
    surfacePermanentAuthError(
      new WorkspaceAuthError(t(sessionErrorMessageKey(code)), code)
    )
  }

  function handleScheduledRefreshOutcome(report: ScheduledRefreshReport): void {
    if (report.outcome === 'succeeded') {
      unifiedScheduledRetryCount = 0
      // Only re-mints rotate the session cookie; the initial login mint and
      // workspace switches establish it themselves.
      useAuthStore().notifyTokenRefreshed()
      trackUnifiedRefresh('succeeded')
      return
    }
    if (report.outcome === 'retry_scheduled') {
      unifiedScheduledRetryCount += 1
      trackUnifiedRefresh('retry_scheduled')
      console.warn('Unified token refresh failed; retrying shortly')
      return
    }
    if (report.outcome === 'retries_exhausted') {
      trackUnifiedRefresh('retries_exhausted')
      console.warn(
        'Unified token refresh failed; retries exhausted, the session ends at expiry unless a reactive re-mint lands first'
      )
      return
    }
    if (report.outcome === 'expired') {
      // The legacy rail's clear-at-expiry: nothing refreshed the token in
      // time, so the workspace session ends rather than serving a dead JWT.
      trackUnifiedRefresh('expired')
      endWorkspaceSession()
      return
    }
    trackUnifiedRefresh('permanent_failure')
    const code = report.failure.code
    surfaceUnifiedPermanentFailure(code)
    endWorkspaceSession(
      unifiedSelectionInvalid(code)
        ? (currentWorkspace.value?.id ?? undefined)
        : undefined
    )
  }

  // One tab per (uid, workspace) proactively refreshes; the rest adopt its
  // published credential. Undefined where the browser lacks the APIs, which
  // falls back to per-tab refresh.
  const crossTabRefreshPort = createWebCrossTabRefreshPort()

  const unifiedSessionClient = createSessionClient<User>(
    {
      exchangeUrl: workspaceApiUrl('/auth/token'),
      autoMint: false,
      // In-memory only: a persisted JWT can outlive its server expiry, so a
      // reload re-mints instead of rehydrating.
      storage: {
        read: () => null,
        write: () => undefined,
        clear: () => undefined
      },
      refreshScheduler: {
        bufferMs: TOKEN_REFRESH_BUFFER_MS,
        retryBaseMs: UNIFIED_REFRESH_RETRY_BASE_MS,
        maxRetries: MAX_SCHEDULED_REFRESH_RETRIES,
        onScheduledOutcome: handleScheduledRefreshOutcome,
        ...(crossTabRefreshPort && {
          crossTab: {
            port: crossTabRefreshPort,
            // A sibling's rotation is still a rotation for this tab: the
            // session cookie and the onAuthTokenRefreshed hook must see it.
            onCredentialAdopted: () => useAuthStore().notifyTokenRefreshed()
          }
        })
      }
    },
    // Observer order against authStore is not load-bearing: unifiedUser() waits for the port's user and fails closed on the ceiling.
    firebaseIdentity
  )

  const stopUnifiedSnapshot = unifiedSessionClient.subscribe((snapshot) => {
    if (snapshot.phase === 'authenticated') {
      const target = currentUnifiedTarget() ?? personalWorkspaceTarget()
      unifiedTarget = target
      unifiedToken.value = snapshot.session.token
      unifiedTokenOwnerUid.value = snapshot.session.uid
      unifiedPermanentFailureSurfaced = false
      // Any successful mint re-arms the scheduler with a fresh retry budget;
      // this telemetry mirror must follow it or retry_count inflates.
      unifiedScheduledRetryCount = 0
      // A unified mint retires the legacy token so a flag rollback cannot serve
      // a stale legacy session under the workspace unified just minted.
      retireLegacyToken()
      currentWorkspace.value = {
        ...snapshot.session.workspace,
        role: snapshot.session.role
      }
      persistWorkspaceIdentity(currentWorkspace.value)
      issuedUnifiedTokenContexts.set(snapshot.session.token, {
        ownerUid: snapshot.session.uid,
        targetKey: unifiedTargetKey(target),
        expiresAt: snapshot.session.expiresAt
      })
      pruneExpiredUnifiedTokenContexts(Date.now())
      return
    }
    unifiedToken.value = null
    unifiedTokenOwnerUid.value = null
  })

  // Identity is bound for the store's lifetime; the flag gates minting, and a
  // rollback invalidates the credential, so scheduler and cross-tab lease stop.
  const stopUnifiedFlagWatch = watch(
    () => flags.unifiedCloudAuthEnabled,
    (enabled) => {
      if (enabled) {
        void mintAtLogin()
        return
      }
      clearUnifiedContext()
    }
  )

  /**
   * The user the port has delivered, once it is the app's current user
   * (both are projections of one Auth instance; the port's user is what
   * mints). Resolves null when nobody is signed in, when a different
   * identity arrives first, or when the port stays silent past the
   * ceiling, so a caller can fail closed instead of hanging.
   */
  function unifiedUser(): Promise<User | null> {
    const expectedUid = useAuthStore().currentUser?.uid ?? null
    const matches = (user: User | null) => (user?.uid ?? null) === expectedUid
    const current = unifiedSessionClient.getSnapshot().user
    if (matches(current)) return Promise.resolve(current)
    return new Promise((resolve) => {
      // Held in an object: subscribe() replays synchronously, and a settle
      // from that replay must never touch a binding declared after it.
      const subscription = { stop: () => {} }
      const settle = (user: User | null) => {
        clearTimeout(ceiling)
        subscription.stop()
        resolve(user)
      }
      const ceiling = setTimeout(() => {
        console.warn('Unified identity did not settle before the ceiling')
        settle(null)
      }, UNIFIED_IDENTITY_SETTLE_TIMEOUT_MS)
      subscription.stop = unifiedSessionClient.subscribe(({ user }) => {
        if (matches(user)) settle(user)
        else if ((user?.uid ?? null) !== (current?.uid ?? null)) settle(null)
      })
    })
  }

  function pruneExpiredUnifiedTokenContexts(now: number): void {
    for (const [token, context] of issuedUnifiedTokenContexts) {
      if (context.expiresAt + ISSUED_TOKEN_CONTEXT_GRACE_MS < now) {
        issuedUnifiedTokenContexts.delete(token)
      }
    }
  }

  function clearUnifiedContext(): void {
    unifiedScheduledRetryCount = 0
    unifiedPermanentFailureSurfaced = false
    issuedUnifiedTokenContexts.clear()
    unifiedTarget = null
    // Fails closed through the client: drops its credential, cancels
    // scheduled work, and blocks in-flight mints from committing.
    unifiedSessionClient.invalidate()
  }

  async function switchUnifiedWorkspace(workspaceId: string): Promise<void> {
    clearWorkspaceContext()
    const { useSessionCookie } =
      await import('@/platform/auth/session/useSessionCookie')
    await useSessionCookie().ensureSessionCookie()
    const authUser = await unifiedUser()
    // A rollback during the awaits above must abort the unified switch rather
    // than commit a token for a flag that is now off.
    if (!unifiedRailEnabled()) return
    if (!authUser) {
      throw new WorkspaceAuthError('Workspace identity changed during switch')
    }
    unifiedTarget = { workspace_id: workspaceId }
    const result = await unifiedSessionClient.remint(authUser, { workspaceId })
    if (result?.status === 'ok') return
    // A workspace we could not enter must not become the next login's
    // target, or an unreachable workspace locks the user out of the personal
    // session that would have worked.
    unifiedTarget = null
    if (result === undefined) {
      throw new WorkspaceAuthError('Workspace identity changed during switch')
    }
    throw new WorkspaceAuthError(
      t(sessionErrorMessageKey(result.code)),
      result.code
    )
  }

  function trackUnifiedRefresh(outcome: UnifiedAuthRefreshOutcome): void {
    useTelemetry()?.trackUnifiedAuthRefresh({
      outcome,
      ...(outcome !== 'succeeded' && {
        retry_count: unifiedScheduledRetryCount
      })
    })
  }

  const mintAtLogin = async (): Promise<boolean> => {
    if (!flags.unifiedCloudAuthEnabled) {
      return false
    }
    if (getUnifiedToken()) {
      return true
    }
    const authUser = await unifiedUser()
    // Re-check after the wait: a rollback that flips the flag off while a mint
    // is parked on unifiedUser() must not let the resumed mint commit a token.
    if (!unifiedRailEnabled() || !authUser) {
      return false
    }
    const target = currentUnifiedTarget() ?? personalWorkspaceTarget()
    unifiedTarget = target
    const result = await unifiedSessionClient.ensureFresh(authUser, {
      workspaceId: unifiedWorkspaceIdFor(target)
    })
    if (result?.status === 'ok') {
      return true
    }
    if (result?.status === 'error') {
      if (isPermanentSessionError(result.code)) {
        surfaceUnifiedPermanentFailure(result.code)
      } else {
        console.warn('Unified login mint failed:', result.code)
      }
      return false
    }
    // An undefined result means another identity event superseded this
    // call; the login succeeded iff a token was committed for it.
    return getUnifiedToken() !== undefined
  }

  const remintUnifiedOnce = async (
    expectedToken: string
  ): Promise<string | null> => {
    if (!flags.unifiedCloudAuthEnabled) {
      return null
    }
    const target = currentUnifiedTarget()
    const ownerUid = currentUserUid()
    const currentToken = getUnifiedToken()
    const expectedContext = issuedUnifiedTokenContexts.get(expectedToken)
    if (
      !target ||
      !ownerUid ||
      !currentToken ||
      expectedContext?.ownerUid !== ownerUid ||
      expectedContext.targetKey !== unifiedTargetKey(target)
    ) {
      return null
    }
    if (expectedToken !== currentToken) return currentToken
    const authUser = await unifiedUser()
    if (!unifiedRailEnabled() || !authUser) return null
    const result = await unifiedSessionClient.remint(authUser, {
      workspaceId: unifiedWorkspaceIdFor(target),
      preserveCredentialOnTransientFailure: true
    })
    if (result?.status === 'ok') {
      useAuthStore().notifyTokenRefreshed()
      return getUnifiedToken() ?? null
    }
    if (result?.status === 'error' && isPermanentSessionError(result.code)) {
      surfaceUnifiedPermanentFailure(result.code)
      endWorkspaceSession(
        unifiedSelectionInvalid(result.code)
          ? (currentWorkspace.value?.id ?? undefined)
          : undefined
      )
    } else if (result?.status === 'error') {
      console.warn('Unified reactive re-mint failed:', result.code)
    }
    return null
  }

  function getUnifiedToken(): string | undefined {
    return unifiedToken.value !== null &&
      unifiedTokenOwnerUid.value !== null &&
      isCurrentUser(unifiedTokenOwnerUid.value)
      ? unifiedToken.value
      : undefined
  }

  function clearWorkspaceContext(): void {
    clearLegacyContext()
    error.value = null
    clearSessionStorage()
    clearUnifiedContext()
  }

  function endWorkspaceSession(revokedWorkspaceId?: string): boolean {
    const hadContext = currentWorkspace.value !== null
    const cancelWorkflowTransition =
      isCloud && hadContext ? prepareWorkflowWorkspaceTransition() : undefined
    const revokedWorkspaceHandled = revokedWorkspaceId
      ? useTeamWorkspaceStore().forgetRevokedActiveWorkspace(revokedWorkspaceId)
      : false
    clearWorkspaceContext()
    const shouldReload = revokedWorkspaceId
      ? !revokedWorkspaceHandled
      : hadContext
    if (isCloud && shouldReload) {
      window.location.reload()
      return false
    }
    cancelWorkflowTransition?.()
    return !isCloud && revokedWorkspaceHandled
  }

  return {
    // State
    currentWorkspace,
    workspaceToken,
    unifiedToken,
    isLoading,
    error,

    // Getters
    isAuthenticated,

    // Actions
    init,
    destroy,
    initializeFromSession,
    switchWorkspace,
    refreshToken,
    mintAtLogin,
    remintUnifiedOnce,
    getWorkspaceAuthHeader,
    ensureWorkspaceAuthHeader,
    ensureWorkspaceToken,
    getWorkspaceToken,
    getUnifiedToken,
    getUnifiedSessionClient,
    getUnifiedMintWorkspaceId,
    clearWorkspaceContext
  }
})
