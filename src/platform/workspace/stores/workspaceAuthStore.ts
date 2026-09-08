import { zWorkspaceWithRole } from '@comfyorg/ingest-types/zod'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { z } from 'zod'

import type { AccountUser, SessionErrorCode } from '@comfyorg/account/core'
import {
  SESSION_ERROR_MESSAGES,
  createSessionClient,
  isPermanentSessionError
} from '@comfyorg/account/core'

import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import type { UnifiedAuthRefreshOutcome } from '@/platform/telemetry/types'
import { prepareWorkflowWorkspaceTransition } from '@/platform/workflow/persistence/base/storageIO'
import {
  TOKEN_REFRESH_BUFFER_MS,
  WORKSPACE_STORAGE_KEYS
} from '@/platform/workspace/workspaceConstants'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAuthStore } from '@/stores/authStore'
import type { AuthHeader } from '@/types/authTypes'
import type { WorkspaceIdentity } from '@/platform/workspace/workspaceTypes'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { workspaceApiUrl } from '@/platform/workspace/api/workspaceApiUrl'

// Picked off the generated schema: a hand-written enum that lags the spec would
// reject a valid persisted identity and silently clear the session.
const WorkspaceIdentitySchema = zWorkspaceWithRole.pick({
  id: true,
  name: true,
  type: true,
  role: true
})

const WorkspaceTokenResponseSchema = z.object({
  token: z.string(),
  expires_at: z.string(),
  workspace: zWorkspaceWithRole.pick({ id: true, name: true, type: true }),
  role: zWorkspaceWithRole.shape.role,
  permissions: z.array(z.string())
})

export type WorkspaceTokenResponse = z.infer<
  typeof WorkspaceTokenResponseSchema
>

const MAX_SCHEDULED_REFRESH_RETRIES = 3

const UNIFIED_REFRESH_RETRY_BASE_MS = 5000

const RECOVERY_COOLDOWN_MS = 5000

// Retain expired unified-token contexts briefly so a concurrent reactive-401
// replay for the just-rotated token still resolves, then evict them so a
// long-lived session cannot grow the context Map unbounded.
const ISSUED_TOKEN_CONTEXT_GRACE_MS = 5 * 60 * 1000

export class WorkspaceAuthError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'WorkspaceAuthError'
  }
}

interface MintedToken {
  token: string
  expiresAt: number
  workspace: WorkspaceIdentity
  ownerUid: string
}

const PERMANENT_AUTH_ERROR_CODES = new Set([
  'ACCESS_DENIED',
  'WORKSPACE_NOT_FOUND',
  'INVALID_FIREBASE_TOKEN',
  'NOT_AUTHENTICATED'
])

function isPermanentAuthError(err: unknown): err is WorkspaceAuthError {
  return (
    err instanceof WorkspaceAuthError &&
    PERMANENT_AUTH_ERROR_CODES.has(err.code ?? '')
  )
}

function isSessionErrorCode(
  code: string | undefined
): code is SessionErrorCode {
  return code !== undefined && code in SESSION_ERROR_MESSAGES
}

// The one code-to-copy mapping; exhaustive so a new code is a compile
// error here instead of a silently wrong fallback toast.
function sessionErrorMessageKey(code: SessionErrorCode): string {
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

  // State
  const currentWorkspace = shallowRef<WorkspaceIdentity | null>(null)
  const workspaceToken = ref<string | null>(null)
  const workspaceTokenExpiresAt = ref<number | null>(null)
  const workspaceTokenOwnerUid = ref<string | null>(null)
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

  // Timer state
  let refreshTimerId: ReturnType<typeof setTimeout> | null = null
  let inFlightSwitchCount = 0
  let inFlightSwitchPromise: Promise<void> | null = null
  let recoveryCooldownUntil = 0
  let scheduledRefreshRetryCount = 0

  // Request ID to prevent stale refresh operations from overwriting newer workspace contexts
  let refreshRequestId = 0

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

  // Private helpers
  function stopRefreshTimer(): void {
    if (refreshTimerId !== null) {
      clearTimeout(refreshTimerId)
      refreshTimerId = null
    }
  }

  function scheduleTokenRefresh(expiresAt: number): void {
    stopRefreshTimer()
    scheduledRefreshRetryCount = 0
    const now = Date.now()
    const refreshAt = expiresAt - TOKEN_REFRESH_BUFFER_MS
    const delay = Math.max(0, refreshAt - now)

    refreshTimerId = setTimeout(() => {
      void refreshToken()
    }, delay)
  }

  function scheduleClearAtExpiry(): void {
    if (workspaceTokenExpiresAt.value === null) {
      endWorkspaceSession()
      return
    }

    const timeUntilExpiry = workspaceTokenExpiresAt.value - Date.now()
    if (timeUntilExpiry <= 0) {
      endWorkspaceSession()
      return
    }

    stopRefreshTimer()
    refreshTimerId = setTimeout(() => {
      endWorkspaceSession()
    }, timeUntilExpiry)
  }

  function scheduleTokenRefreshRetry(delayMs: number): boolean {
    if (workspaceTokenExpiresAt.value === null) {
      endWorkspaceSession()
      return false
    }

    const timeUntilExpiry = workspaceTokenExpiresAt.value - Date.now()
    if (timeUntilExpiry <= 0) {
      endWorkspaceSession()
      return false
    }

    if (scheduledRefreshRetryCount >= MAX_SCHEDULED_REFRESH_RETRIES) {
      scheduleClearAtExpiry()
      return false
    }

    scheduledRefreshRetryCount += 1
    stopRefreshTimer()
    const timeUntilRefreshBuffer = Math.max(
      0,
      timeUntilExpiry - TOKEN_REFRESH_BUFFER_MS
    )
    refreshTimerId = setTimeout(
      () => {
        void refreshToken()
      },
      Math.min(delayMs, timeUntilRefreshBuffer)
    )
    return true
  }

  function isStaleWorkspaceRequest(
    capturedRequestId: number,
    ownerUid?: string | null
  ): boolean {
    return (
      capturedRequestId !== refreshRequestId ||
      (ownerUid !== undefined && ownerUid !== null && !isCurrentUser(ownerUid))
    )
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

  function persistToSession(
    workspace: WorkspaceIdentity,
    token: string,
    expiresAt: number,
    ownerUid: string
  ): void {
    persistWorkspaceIdentity(workspace)
    try {
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.TOKEN, token)
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT,
        expiresAt.toString()
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.OWNER_UID, ownerUid)
    } catch {
      console.warn('Failed to persist workspace token to sessionStorage')
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
    detachUnifiedIdentity?.()
    detachUnifiedIdentity = undefined
  }

  function initializeFromSession(): boolean {
    try {
      const workspaceJson = sessionStorage.getItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE
      )
      const token = sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)
      const expiresAtStr = sessionStorage.getItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT
      )
      const ownerUid = sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.OWNER_UID)

      if (
        !workspaceJson ||
        !token ||
        !expiresAtStr ||
        !ownerUid ||
        !isCurrentUser(ownerUid)
      ) {
        clearSessionStorage()
        return false
      }

      const expiresAt = parseInt(expiresAtStr, 10)
      if (isNaN(expiresAt) || expiresAt <= Date.now()) {
        clearSessionStorage()
        return false
      }

      const parseResult = WorkspaceIdentitySchema.safeParse(
        JSON.parse(workspaceJson)
      )

      if (!parseResult.success) {
        clearSessionStorage()
        return false
      }

      currentWorkspace.value = parseResult.data
      workspaceToken.value = token
      workspaceTokenExpiresAt.value = expiresAt
      workspaceTokenOwnerUid.value = ownerUid
      error.value = null

      scheduleTokenRefresh(expiresAt)
      return true
    } catch {
      clearSessionStorage()
      return false
    }
  }

  /**
   * Exchanges the Firebase identity for a Cloud JWT via POST /auth/token.
   * An id-less body ({}) mints the caller's personal-workspace token; a
   * concrete workspace_id mints that workspace's token. Pure network + parse:
   * it writes no store state, schedules no timer, and reads no flag, so both
   * the legacy switch path and the unified path can reuse it without inheriting
   * each other's gates.
   */
  async function requestToken(workspaceId?: string): Promise<MintedToken> {
    const ownerUid = currentUserUid()
    if (!ownerUid) {
      throw new WorkspaceAuthError(
        t('workspaceAuth.errors.notAuthenticated'),
        'NOT_AUTHENTICATED'
      )
    }

    const firebaseToken = await useAuthStore().getIdToken()
    if (!firebaseToken) {
      throw new WorkspaceAuthError(
        t('workspaceAuth.errors.notAuthenticated'),
        'NOT_AUTHENTICATED'
      )
    }

    const response = await fetch(workspaceApiUrl('/auth/token'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workspaceId ? { workspace_id: workspaceId } : {})
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new WorkspaceAuthError(
          t('workspaceAuth.errors.invalidFirebaseToken'),
          'INVALID_FIREBASE_TOKEN'
        )
      }
      if (response.status === 403) {
        throw new WorkspaceAuthError(
          t('workspaceAuth.errors.accessDenied'),
          'ACCESS_DENIED'
        )
      }
      if (response.status === 404) {
        throw new WorkspaceAuthError(
          t('workspaceAuth.errors.workspaceNotFound'),
          'WORKSPACE_NOT_FOUND'
        )
      }

      throw new WorkspaceAuthError(
        t('workspaceAuth.errors.tokenExchangeFailed'),
        'TOKEN_EXCHANGE_FAILED'
      )
    }

    const rawData = await response.json()
    const parseResult = WorkspaceTokenResponseSchema.safeParse(rawData)

    if (!parseResult.success) {
      throw new WorkspaceAuthError(
        t('workspaceAuth.errors.tokenExchangeFailed'),
        'TOKEN_EXCHANGE_FAILED'
      )
    }

    const data = parseResult.data
    const expiresAt = new Date(data.expires_at).getTime()

    if (isNaN(expiresAt)) {
      throw new WorkspaceAuthError(
        t('workspaceAuth.errors.tokenExchangeFailed'),
        'TOKEN_EXCHANGE_FAILED'
      )
    }

    return {
      token: data.token,
      expiresAt,
      workspace: { ...data.workspace, role: data.role },
      ownerUid
    }
  }

  async function performSwitchWorkspace(workspaceId: string): Promise<void> {
    const capturedRequestId = refreshRequestId
    const capturedOwnerUid = currentUserUid()

    inFlightSwitchCount += 1
    isLoading.value = true
    error.value = null

    try {
      const { useSessionCookie } =
        await import('@/platform/auth/session/useSessionCookie')
      await useSessionCookie().ensureSessionCookie()
      if (isStaleWorkspaceRequest(capturedRequestId, capturedOwnerUid)) return

      const { token, expiresAt, workspace, ownerUid } =
        await requestToken(workspaceId)

      if (isStaleWorkspaceRequest(capturedRequestId, ownerUid)) {
        console.warn(
          'Aborting stale workspace switch: workspace context changed before commit'
        )
        return
      }

      if (currentWorkspace.value?.id !== workspaceId) {
        refreshRequestId++
      }
      currentWorkspace.value = workspace
      workspaceToken.value = token
      workspaceTokenExpiresAt.value = expiresAt
      workspaceTokenOwnerUid.value = ownerUid
      scheduledRefreshRetryCount = 0
      recoveryCooldownUntil = 0

      persistToSession(workspace, token, expiresAt, ownerUid)
      scheduleTokenRefresh(expiresAt)
    } catch (err) {
      if (isStaleWorkspaceRequest(capturedRequestId, capturedOwnerUid)) {
        console.warn(
          'Aborting stale workspace switch: workspace context changed before error commit',
          err
        )
        return
      }

      error.value = err instanceof Error ? err : new Error(String(err))
      throw error.value
    } finally {
      inFlightSwitchCount = Math.max(0, inFlightSwitchCount - 1)
      isLoading.value = inFlightSwitchCount > 0
    }
  }

  function switchWorkspace(workspaceId: string): Promise<void> {
    if (flags.unifiedCloudAuthEnabled) {
      return switchUnifiedWorkspace(workspaceId)
    }

    const promise = performSwitchWorkspace(workspaceId)
    inFlightSwitchPromise = promise
    void promise
      .catch(() => {})
      .finally(() => {
        if (inFlightSwitchPromise === promise) {
          inFlightSwitchPromise = null
        }
      })
    return promise
  }

  function hasValidTokenForWorkspace(workspaceId: string | undefined): boolean {
    return (
      hasValidWorkspaceToken() &&
      (workspaceId === undefined || currentWorkspace.value?.id === workspaceId)
    )
  }

  // NOT_AUTHENTICATED while still signed in is a transient network failure, not
  // a revoked session, so it must not tear down a valid context.
  function isPermanentRecoveryFailure(err: unknown): err is WorkspaceAuthError {
    if (!isPermanentAuthError(err)) {
      return false
    }
    if (err.code === 'NOT_AUTHENTICATED' && useAuthStore().currentUser) {
      return false
    }
    return true
  }

  // The workspace selection itself is invalid (revoked or deleted), so
  // abandoning it can help — unlike a plain auth failure.
  function isWorkspaceSelectionInvalid(
    err: unknown
  ): err is WorkspaceAuthError {
    return (
      err instanceof WorkspaceAuthError &&
      (err.code === 'ACCESS_DENIED' || err.code === 'WORKSPACE_NOT_FOUND')
    )
  }

  function startRecoveryCooldown(): void {
    recoveryCooldownUntil = Date.now() + RECOVERY_COOLDOWN_MS
  }

  function handleRecoveryFailure(
    err: unknown,
    failedWorkspaceId?: string
  ): void {
    let invalidSelectionHandled = false
    if (isPermanentRecoveryFailure(err)) {
      const hadContext = currentWorkspace.value !== null
      invalidSelectionHandled = endWorkspaceSession(
        failedWorkspaceId && isWorkspaceSelectionInvalid(err)
          ? failedWorkspaceId
          : undefined
      )
      if (hadContext) {
        surfacePermanentAuthError(err)
      }
    }
    if (!invalidSelectionHandled) startRecoveryCooldown()
    console.warn('Workspace auth recovery failed:', err)
  }

  /**
   * Resolve a valid workspace token, minting one if needed. Coalesces a burst of
   * callers onto a single in-flight mint, backs off after failure, and returns
   * null so callers fail closed rather than downgrade to the personal identity.
   */
  async function ensureWorkspaceToken(
    preferredWorkspaceId?: string
  ): Promise<string | null> {
    const ownerUid = currentUserUid()
    if (!ownerUid) return null
    const targetWorkspaceId = preferredWorkspaceId ?? currentWorkspace.value?.id

    while (true) {
      if (!isCurrentUser(ownerUid)) return null
      if (hasValidTokenForWorkspace(targetWorkspaceId)) {
        return workspaceToken.value
      }

      // Join any in-flight mint and re-check rather than launching our own.
      if (inFlightSwitchPromise) {
        await inFlightSwitchPromise.catch(() => {})
        if (!isCurrentUser(ownerUid)) return null
        if (!isCloud && currentWorkspace.value?.id !== targetWorkspaceId) {
          return null
        }
        continue
      }

      if (!targetWorkspaceId || Date.now() < recoveryCooldownUntil) {
        return null
      }
      if (
        !isCloud &&
        useTeamWorkspaceStore().activeWorkspaceId !== targetWorkspaceId
      ) {
        return null
      }

      try {
        await switchWorkspace(targetWorkspaceId)
      } catch (err) {
        if (!isCurrentUser(ownerUid)) return null
        handleRecoveryFailure(err, targetWorkspaceId)
        return null
      }

      if (!isCurrentUser(ownerUid)) return null
      if (hasValidTokenForWorkspace(targetWorkspaceId)) {
        return workspaceToken.value
      }

      // Resolved without a usable token; back off like a failure and fail closed.
      startRecoveryCooldown()
      return null
    }
  }

  async function ensureWorkspaceAuthHeader(
    preferredWorkspaceId?: string
  ): Promise<AuthHeader | null> {
    const token = await ensureWorkspaceToken(preferredWorkspaceId)
    return token ? { Authorization: `Bearer ${token}` } : null
  }

  async function refreshToken(): Promise<void> {
    if (!currentWorkspace.value) {
      return
    }

    const workspaceId = currentWorkspace.value.id
    const capturedRequestId = refreshRequestId
    const maxRetries = 3
    const baseDelayMs = 1000
    // Clear any previous error optimistically; a stale-aborted refresh should
    // not leave a stale error visible on the new workspace's context.
    error.value = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (isStaleWorkspaceRequest(capturedRequestId)) {
        console.warn(
          'Aborting stale token refresh: workspace context changed during refresh'
        )
        return
      }

      try {
        await switchWorkspace(workspaceId)
        return
      } catch (err) {
        const isAuthError = err instanceof WorkspaceAuthError

        const isPermanentError =
          isAuthError &&
          (err.code === 'ACCESS_DENIED' ||
            err.code === 'WORKSPACE_NOT_FOUND' ||
            err.code === 'INVALID_FIREBASE_TOKEN' ||
            err.code === 'NOT_AUTHENTICATED')

        if (isPermanentError) {
          if (!isStaleWorkspaceRequest(capturedRequestId)) {
            console.error('Workspace access revoked or auth invalid:', err)
            endWorkspaceSession(
              isWorkspaceSelectionInvalid(err) ? workspaceId : undefined
            )
          }
          return
        }

        const isTransientError =
          isAuthError && err.code === 'TOKEN_EXCHANGE_FAILED'

        if (isTransientError && attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt)
          console.warn(
            `Token refresh failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`,
            err
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        if (!isStaleWorkspaceRequest(capturedRequestId)) {
          if (isTransientError && hasValidWorkspaceToken()) {
            error.value = null
            const retryScheduled = scheduleTokenRefreshRetry(
              baseDelayMs * Math.pow(2, maxRetries)
            )
            console.warn(
              retryScheduled
                ? 'Failed to refresh workspace token after retries; preserving existing valid token and retrying later:'
                : 'Failed to refresh workspace token after retries; preserving existing valid token until expiry:',
              err
            )
            return
          }

          console.error('Failed to refresh workspace token after retries:', err)
          endWorkspaceSession()
        }
      }
    }
  }

  // --- Unified Cloud-JWT lifecycle (flag-gated: unified_cloud_auth) ----------
  //
  // The mint/refresh machinery is delegated to @comfyorg/account's session
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
  let detachUnifiedIdentity: (() => void) | undefined

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

  function unifiedSelectionInvalid(code: SessionErrorCode): boolean {
    return code === 'ACCESS_DENIED' || code === 'WORKSPACE_NOT_FOUND'
  }

  function accountUserFor(user: { uid: string }): AccountUser {
    return {
      uid: user.uid,
      getIdToken: async () => {
        // Owner gone or changed mid-flight (Firebase re-initializing) is a
        // transient condition the scheduler retries silently; a signed-in
        // owner whose token read comes back empty is NOT_AUTHENTICATED,
        // exactly as requestToken maps it.
        const owner = useAuthStore().currentUser
        if (!owner || owner.uid !== user.uid) {
          throw new WorkspaceAuthError('Unified mint owner changed mid-flight')
        }
        const token = await useAuthStore().getIdToken()
        if (!token) {
          throw new WorkspaceAuthError(
            t('workspaceAuth.errors.notAuthenticated'),
            'NOT_AUTHENTICATED'
          )
        }
        return token
      }
    }
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

  function handleScheduledRefreshOutcome(
    outcome: UnifiedAuthRefreshOutcome
  ): void {
    if (outcome === 'succeeded') {
      unifiedScheduledRetryCount = 0
      // Only re-mints rotate the session cookie; the initial login mint and
      // workspace switches establish it themselves.
      useAuthStore().notifyTokenRefreshed()
      trackUnifiedRefresh('succeeded')
      return
    }
    if (outcome === 'retry_scheduled') {
      unifiedScheduledRetryCount += 1
      trackUnifiedRefresh('retry_scheduled')
      console.warn('Unified token refresh failed; retrying shortly')
      return
    }
    if (outcome === 'retries_exhausted') {
      trackUnifiedRefresh('retries_exhausted')
      console.warn(
        'Unified token refresh failed; retries exhausted, awaiting a reactive re-mint'
      )
      return
    }
    trackUnifiedRefresh('permanent_failure')
    const snapshot = unifiedSessionClient.getSnapshot()
    const code =
      snapshot.phase === 'error'
        ? snapshot.failure.code
        : 'TOKEN_EXCHANGE_FAILED'
    surfaceUnifiedPermanentFailure(code)
    endWorkspaceSession(
      unifiedSelectionInvalid(code)
        ? (currentWorkspace.value?.id ?? undefined)
        : undefined
    )
  }

  const unifiedSessionClient = createSessionClient({
    exchangeUrl: workspaceApiUrl('/auth/token'),
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
      onScheduledOutcome: handleScheduledRefreshOutcome
    }
  })

  unifiedSessionClient.subscribe((snapshot) => {
    if (snapshot.phase === 'authenticated') {
      const target = currentUnifiedTarget() ?? personalWorkspaceTarget()
      unifiedTarget = target
      unifiedToken.value = snapshot.session.token
      unifiedTokenOwnerUid.value = snapshot.session.uid
      unifiedPermanentFailureSurfaced = false
      // Any successful mint re-arms the scheduler with a fresh retry budget;
      // this telemetry mirror must follow it or retry_count inflates.
      unifiedScheduledRetryCount = 0
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

  let deliverUnifiedIdentity: ((user: AccountUser | null) => void) | undefined

  // Transitional migration adapter (ADR-AUTH-IDENTITY-0028): the Pinia
  // authStore remains the identity authority; its auth-state listener pushes
  // every identity diff here, and the unified entry points re-sync
  // defensively before they mint.
  function syncUnifiedIdentity(): void {
    if (!flags.unifiedCloudAuthEnabled) return
    if (detachUnifiedIdentity === undefined) {
      detachUnifiedIdentity = unifiedSessionClient.attachIdentity(
        {
          onUserChanged: (callback) => {
            deliverUnifiedIdentity = callback
            return () => {
              deliverUnifiedIdentity = undefined
            }
          }
        },
        { autoMint: false }
      )
    }
    const user = useAuthStore().currentUser
    const clientUser = unifiedSessionClient.getSnapshot().user
    if ((user?.uid ?? null) !== (clientUser?.uid ?? null)) {
      deliverUnifiedIdentity?.(user ? accountUserFor(user) : null)
    }
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
    const authUser = useAuthStore().currentUser
    if (!authUser) {
      throw new WorkspaceAuthError('Workspace identity changed during switch')
    }
    syncUnifiedIdentity()
    unifiedTarget = { workspace_id: workspaceId }
    const result = await unifiedSessionClient.remint(accountUserFor(authUser), {
      workspaceId
    })
    if (result?.status === 'error') {
      throw new WorkspaceAuthError(
        t(sessionErrorMessageKey(result.code)),
        result.code
      )
    }
    if (result === undefined) {
      throw new WorkspaceAuthError('Workspace identity changed during switch')
    }
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
    const authUser = useAuthStore().currentUser
    if (!authUser) {
      return false
    }
    syncUnifiedIdentity()
    const target = currentUnifiedTarget() ?? personalWorkspaceTarget()
    unifiedTarget = target
    const result = await unifiedSessionClient.ensureFresh(
      accountUserFor(authUser),
      { workspaceId: unifiedWorkspaceIdFor(target) }
    )
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
    const authUser = useAuthStore().currentUser
    if (!authUser) return null
    syncUnifiedIdentity()
    const result = await unifiedSessionClient.remint(accountUserFor(authUser), {
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

  function getWorkspaceAuthHeader(): AuthHeader | null {
    if (!hasValidWorkspaceToken()) {
      return null
    }
    return {
      Authorization: `Bearer ${workspaceToken.value}`
    }
  }

  function getWorkspaceToken(): string | undefined {
    return hasValidWorkspaceToken()
      ? (workspaceToken.value ?? undefined)
      : undefined
  }

  function hasValidWorkspaceToken(): boolean {
    return (
      workspaceToken.value !== null &&
      workspaceTokenExpiresAt.value !== null &&
      workspaceTokenExpiresAt.value > Date.now() &&
      workspaceTokenOwnerUid.value !== null &&
      isCurrentUser(workspaceTokenOwnerUid.value)
    )
  }

  function getUnifiedToken(): string | undefined {
    return unifiedToken.value !== null &&
      unifiedTokenOwnerUid.value !== null &&
      isCurrentUser(unifiedTokenOwnerUid.value)
      ? unifiedToken.value
      : undefined
  }

  function clearWorkspaceContext(): void {
    refreshRequestId++
    stopRefreshTimer()
    currentWorkspace.value = null
    workspaceToken.value = null
    workspaceTokenExpiresAt.value = null
    workspaceTokenOwnerUid.value = null
    scheduledRefreshRetryCount = 0
    recoveryCooldownUntil = 0
    // refreshRequestId bump above aborts any in-flight switch before it commits.
    inFlightSwitchPromise = null
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
    syncUnifiedIdentity,
    getWorkspaceAuthHeader,
    ensureWorkspaceAuthHeader,
    ensureWorkspaceToken,
    getWorkspaceToken,
    getUnifiedToken,
    clearWorkspaceContext
  }
})
