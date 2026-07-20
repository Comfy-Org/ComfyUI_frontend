import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { t } from '@/i18n'
import {
  TOKEN_REFRESH_BUFFER_MS,
  WORKSPACE_STORAGE_KEYS
} from '@/platform/workspace/workspaceConstants'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import type { AuthHeader } from '@/types/authTypes'
import type { WorkspaceWithRole } from '@/platform/workspace/workspaceTypes'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

const WorkspaceWithRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['personal', 'team']),
  role: z.enum(['owner', 'member'])
})

const WorkspaceTokenResponseSchema = z.object({
  token: z.string(),
  expires_at: z.string(),
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['personal', 'team'])
  }),
  role: z.enum(['owner', 'member']),
  permissions: z.array(z.string())
})

export type WorkspaceTokenResponse = z.infer<
  typeof WorkspaceTokenResponseSchema
>

const MAX_SCHEDULED_REFRESH_RETRIES = 3

const RECOVERY_COOLDOWN_MS = 5000

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
  workspace: WorkspaceWithRole
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

function permanentAuthErrorMessageKey(code: string | undefined): string {
  switch (code) {
    case 'ACCESS_DENIED':
      return 'workspaceAuth.errors.accessDenied'
    case 'WORKSPACE_NOT_FOUND':
      return 'workspaceAuth.errors.workspaceNotFound'
    case 'INVALID_FIREBASE_TOKEN':
      return 'workspaceAuth.errors.invalidFirebaseToken'
    default:
      return 'workspaceAuth.errors.notAuthenticated'
  }
}

// Flag-ON has no Firebase fallback, so surface permanent failures instead of
// stranding every cloud request on a silently cleared token.
function surfacePermanentAuthError(err: WorkspaceAuthError): void {
  console.error('Unified workspace auth revoked or invalid:', err)
  useToastStore().add({
    severity: 'error',
    summary: t('g.error'),
    detail: t(permanentAuthErrorMessageKey(err.code))
  })
}

export const useWorkspaceAuthStore = defineStore('workspaceAuth', () => {
  const { flags } = useFeatureFlags()

  // State
  const currentWorkspace = shallowRef<WorkspaceWithRole | null>(null)
  const workspaceToken = ref<string | null>(null)
  const workspaceTokenExpiresAt = ref<number | null>(null)
  const workspaceTokenOwnerUid = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  // Unified Cloud-JWT slot (flag-gated: unified_cloud_auth). Dormant in this PR:
  // populated by the unified mint lifecycle below but read by no consumer until
  // the PR 3 consumer flip, so it cannot change which token requests carry.
  const unifiedToken = ref<string | null>(null)
  const unifiedTokenOwnerUid = ref<string | null>(null)
  const issuedUnifiedTokenOwners = new Map<string, string>()

  // Timer state
  let refreshTimerId: ReturnType<typeof setTimeout> | null = null
  let inFlightSwitchCount = 0
  let inFlightSwitchPromise: Promise<void> | null = null
  let recoveryCooldownUntil = 0
  let scheduledRefreshRetryCount = 0
  // The unified lifecycle keeps its own timer + request-id so it never shares
  // mutable state with the legacy switchWorkspace/refreshToken machinery.
  let unifiedRefreshTimerId: ReturnType<typeof setTimeout> | null = null

  // Request ID to prevent stale refresh operations from overwriting newer workspace contexts
  let refreshRequestId = 0
  let unifiedRefreshRequestId = 0

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
      clearWorkspaceContext()
      return
    }

    const timeUntilExpiry = workspaceTokenExpiresAt.value - Date.now()
    if (timeUntilExpiry <= 0) {
      clearWorkspaceContext()
      return
    }

    stopRefreshTimer()
    refreshTimerId = setTimeout(() => {
      clearWorkspaceContext()
    }, timeUntilExpiry)
  }

  function scheduleTokenRefreshRetry(delayMs: number): boolean {
    if (workspaceTokenExpiresAt.value === null) {
      clearWorkspaceContext()
      return false
    }

    const timeUntilExpiry = workspaceTokenExpiresAt.value - Date.now()
    if (timeUntilExpiry <= 0) {
      clearWorkspaceContext()
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

  function persistToSession(
    workspace: WorkspaceWithRole,
    token: string,
    expiresAt: number,
    ownerUid: string
  ): void {
    try {
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify(workspace)
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.TOKEN, token)
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.EXPIRES_AT,
        expiresAt.toString()
      )
      sessionStorage.setItem(WORKSPACE_STORAGE_KEYS.OWNER_UID, ownerUid)
    } catch {
      console.warn('Failed to persist workspace context to sessionStorage')
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
  }

  function initializeFromSession(): boolean {
    if (!flags.teamWorkspacesEnabled) {
      return false
    }

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

      const parseResult = WorkspaceWithRoleSchema.safeParse(
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

    const response = await fetch(api.apiURL('/auth/token'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workspaceId ? { workspace_id: workspaceId } : {})
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const message = errorData.message || response.statusText

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
        t('workspaceAuth.errors.tokenExchangeFailed', { error: message }),
        'TOKEN_EXCHANGE_FAILED'
      )
    }

    const rawData = await response.json()
    const parseResult = WorkspaceTokenResponseSchema.safeParse(rawData)

    if (!parseResult.success) {
      throw new WorkspaceAuthError(
        t('workspaceAuth.errors.tokenExchangeFailed', {
          error: fromZodError(parseResult.error).message
        }),
        'TOKEN_EXCHANGE_FAILED'
      )
    }

    const data = parseResult.data
    const expiresAt = new Date(data.expires_at).getTime()

    if (isNaN(expiresAt)) {
      throw new WorkspaceAuthError(
        t('workspaceAuth.errors.tokenExchangeFailed', {
          error: 'Invalid expiry timestamp'
        }),
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
    if (!flags.teamWorkspacesEnabled) {
      return
    }

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
    if (isPermanentRecoveryFailure(err)) {
      const hadContext = currentWorkspace.value !== null
      clearWorkspaceContext()
      if (hadContext) {
        surfacePermanentAuthError(err)
      }
      if (failedWorkspaceId && isWorkspaceSelectionInvalid(err)) {
        useTeamWorkspaceStore().forgetRevokedActiveWorkspace(failedWorkspaceId)
      }
    }
    startRecoveryCooldown()
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
    if (!flags.teamWorkspacesEnabled) {
      return null
    }

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
        continue
      }

      if (!targetWorkspaceId || Date.now() < recoveryCooldownUntil) {
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
            clearWorkspaceContext()
            if (isWorkspaceSelectionInvalid(err)) {
              useTeamWorkspaceStore().forgetRevokedActiveWorkspace(workspaceId)
            }
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
          clearWorkspaceContext()
        }
      }
    }
  }

  // --- Unified Cloud-JWT lifecycle (flag-gated: unified_cloud_auth) ----------
  //
  // A parallel mint/refresh lifecycle that writes to the dormant `unifiedToken`
  // slot. The legacy switchWorkspace/refreshToken machinery above is untouched.
  //
  // TODO(unified): call forgetRevokedActiveWorkspace on
  // ACCESS_DENIED/WORKSPACE_NOT_FOUND here too, with the PR-3 consumer flip.

  // Mint body the unified session re-mints against: `{}` = personal (resolved
  // server-side from the Firebase identity), `{ workspace_id }` = explicit.
  type UnifiedMintBody = Record<string, never> | { workspace_id: string }
  interface InFlightUnifiedMint {
    ownerUid: string | null
    targetKey: string
    promise: Promise<boolean>
  }

  let unifiedTarget: UnifiedMintBody | null = null
  let inFlightUnifiedMint: InFlightUnifiedMint | null = null

  function personalWorkspaceTarget(): UnifiedMintBody {
    return {}
  }

  function currentUnifiedTarget(): UnifiedMintBody | null {
    return unifiedTarget
  }

  function unifiedTargetKey(target: UnifiedMintBody): string {
    return 'workspace_id' in target ? target.workspace_id : 'personal'
  }

  function stopUnifiedRefreshTimer(): void {
    if (unifiedRefreshTimerId !== null) {
      clearTimeout(unifiedRefreshTimerId)
      unifiedRefreshTimerId = null
    }
  }

  function scheduleUnifiedRefresh(expiresAt: number): void {
    stopUnifiedRefreshTimer()
    const now = Date.now()
    const refreshAt = expiresAt - TOKEN_REFRESH_BUFFER_MS
    const delay = Math.max(0, refreshAt - now)

    unifiedRefreshTimerId = setTimeout(() => {
      void refreshUnified()
    }, delay)
  }

  function clearUnifiedContext(): void {
    unifiedRefreshRequestId++
    stopUnifiedRefreshTimer()
    unifiedToken.value = null
    unifiedTokenOwnerUid.value = null
    issuedUnifiedTokenOwners.clear()
    unifiedTarget = null
    inFlightUnifiedMint = null
  }

  async function performUnifiedMint(
    target: UnifiedMintBody,
    capturedOwnerUid: string | null
  ): Promise<boolean> {
    const capturedRequestId = ++unifiedRefreshRequestId
    const workspaceId =
      'workspace_id' in target ? target.workspace_id : undefined

    let mintedToken: MintedToken
    try {
      mintedToken = await requestToken(workspaceId)
    } catch (err) {
      if (
        capturedRequestId !== unifiedRefreshRequestId ||
        capturedOwnerUid === null ||
        !isCurrentUser(capturedOwnerUid)
      ) {
        return false
      }
      throw err
    }

    if (
      capturedRequestId !== unifiedRefreshRequestId ||
      !isCurrentUser(mintedToken.ownerUid)
    ) {
      return false
    }

    unifiedToken.value = mintedToken.token
    unifiedTokenOwnerUid.value = mintedToken.ownerUid
    issuedUnifiedTokenOwners.set(mintedToken.token, mintedToken.ownerUid)
    unifiedTarget = target
    scheduleUnifiedRefresh(mintedToken.expiresAt)
    return true
  }

  function mintUnified(target: UnifiedMintBody): Promise<boolean> {
    const ownerUid = currentUserUid()
    const targetKey = unifiedTargetKey(target)
    if (
      inFlightUnifiedMint?.ownerUid === ownerUid &&
      inFlightUnifiedMint.targetKey === targetKey
    ) {
      return inFlightUnifiedMint.promise
    }

    const promise = performUnifiedMint(target, ownerUid).finally(() => {
      if (inFlightUnifiedMint?.promise === promise) {
        inFlightUnifiedMint = null
      }
    })
    inFlightUnifiedMint = { ownerUid, targetKey, promise }
    return promise
  }

  async function refreshUnified(): Promise<void> {
    if (!flags.unifiedCloudAuthEnabled) {
      return
    }
    const target = currentUnifiedTarget()
    if (!target) {
      return
    }

    try {
      const minted = await mintUnified(target)
      // Only a refresh re-mint rotates the session cookie; the initial login
      // mint and workspace switches do not. A stale (discarded) re-mint does not
      // rotate either.
      if (minted) {
        useAuthStore().notifyTokenRefreshed()
      }
    } catch (err) {
      // Guard the toast on a live token so concurrent permanent failures across
      // the proactive + reactive paths alarm the user once, not once per caller.
      if (isPermanentAuthError(err)) {
        if (getUnifiedToken()) surfacePermanentAuthError(err)
        clearUnifiedContext()
      } else {
        console.warn('Unified token refresh failed:', err)
      }
    }
  }

  const mintAtLogin = async (): Promise<boolean> => {
    if (!flags.unifiedCloudAuthEnabled) {
      return false
    }
    if (getUnifiedToken()) {
      return true
    }
    try {
      return await mintUnified(personalWorkspaceTarget())
    } catch (err) {
      if (isPermanentAuthError(err)) {
        surfacePermanentAuthError(err)
      } else {
        console.warn('Unified login mint failed:', err)
      }
      return false
    }
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
    if (
      !target ||
      !ownerUid ||
      !currentToken ||
      issuedUnifiedTokenOwners.get(expectedToken) !== ownerUid
    ) {
      return null
    }
    if (expectedToken !== currentToken) return currentToken
    try {
      const minted = await mintUnified(target)
      if (!minted) return null
      return getUnifiedToken() ?? null
    } catch (err) {
      // Mirror refreshUnified: a permanent failure tears down the session;
      // guard the toast on a live token so a concurrent burst surfaces it once.
      if (isPermanentAuthError(err)) {
        if (getUnifiedToken()) surfacePermanentAuthError(err)
        clearUnifiedContext()
      } else {
        console.warn('Unified reactive re-mint failed:', err)
      }
      return null
    }
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
    clearWorkspaceContext
  }
})
