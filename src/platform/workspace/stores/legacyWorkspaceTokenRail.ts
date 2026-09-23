import { zWorkspaceWithRole } from '@comfyorg/ingest-types/zod'
import { delay } from 'es-toolkit'
import type { Ref, ShallowRef } from 'vue'
import { ref } from 'vue'
import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { parseErrorResponse } from '@/platform/remote/comfyui/errors'
import { workspaceApiUrl } from '@/platform/workspace/api/workspaceApiUrl'
import { WorkspaceAuthError } from '@/platform/workspace/stores/workspaceAuthError'
import {
  MAX_SCHEDULED_REFRESH_RETRIES,
  TOKEN_REFRESH_BUFFER_MS,
  WORKSPACE_STORAGE_KEYS
} from '@/platform/workspace/workspaceConstants'
import type { WorkspaceIdentity } from '@/platform/workspace/workspaceTypes'
import type { AuthHeader } from '@/types/authTypes'

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

const RECOVERY_COOLDOWN_MS = 5000

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

interface StoredSession {
  workspace: WorkspaceIdentity
  token: string
  expiresAt: number
  ownerUid: string
}

function isPermanentAuthError(err: unknown): err is WorkspaceAuthError {
  return (
    err instanceof WorkspaceAuthError &&
    PERMANENT_AUTH_ERROR_CODES.has(err.code ?? '')
  )
}

function isTransientAuthError(err: unknown): err is WorkspaceAuthError {
  return (
    err instanceof WorkspaceAuthError && err.code === 'TOKEN_EXCHANGE_FAILED'
  )
}

function notAuthenticatedError(): WorkspaceAuthError {
  return new WorkspaceAuthError(
    t('workspaceAuth.errors.notAuthenticated'),
    'NOT_AUTHENTICATED'
  )
}

function tokenExchangeFailedError(error: string): WorkspaceAuthError {
  return new WorkspaceAuthError(
    t('workspaceAuth.errors.tokenExchangeFailed', { error }),
    'TOKEN_EXCHANGE_FAILED'
  )
}

function tokenExchangeErrorForStatus(
  status: number,
  message: string
): WorkspaceAuthError {
  if (status === 401) {
    return new WorkspaceAuthError(
      t('workspaceAuth.errors.invalidFirebaseToken'),
      'INVALID_FIREBASE_TOKEN'
    )
  }
  if (status === 403) {
    return new WorkspaceAuthError(
      t('workspaceAuth.errors.accessDenied'),
      'ACCESS_DENIED'
    )
  }
  if (status === 404) {
    return new WorkspaceAuthError(
      t('workspaceAuth.errors.workspaceNotFound'),
      'WORKSPACE_NOT_FOUND'
    )
  }
  return tokenExchangeFailedError(message)
}

function parseMintedToken(rawData: unknown, ownerUid: string): MintedToken {
  const parseResult = WorkspaceTokenResponseSchema.safeParse(rawData)
  if (!parseResult.success) {
    throw tokenExchangeFailedError(fromZodError(parseResult.error).message)
  }

  const data = parseResult.data
  const expiresAt = new Date(data.expires_at).getTime()
  if (isNaN(expiresAt)) {
    throw tokenExchangeFailedError('Invalid expiry timestamp')
  }

  return {
    token: data.token,
    expiresAt,
    workspace: { ...data.workspace, role: data.role },
    ownerUid
  }
}

const REFRESH_ATTEMPT_MAX_RETRIES = 3
const REFRESH_BASE_DELAY_MS = 1000

function refreshBackoffMs(attempt: number): number {
  return REFRESH_BASE_DELAY_MS * Math.pow(2, attempt)
}

export interface LegacyWorkspaceTokenRailDeps {
  currentWorkspace: ShallowRef<WorkspaceIdentity | null>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  currentUserUid: () => string | null
  isCurrentUser: (ownerUid: string) => boolean
  getIdToken: () => Promise<string | undefined>
  hasSignedInUser: () => boolean
  activeWorkspaceId: () => string | null
  switchWorkspace: (workspaceId: string) => Promise<void>
  endWorkspaceSession: (revokedWorkspaceId?: string) => boolean
  persistWorkspaceIdentity: (workspace: WorkspaceIdentity) => void
  clearSessionStorage: () => void
  surfacePermanentAuthError: (err: WorkspaceAuthError) => void
}

export function createLegacyWorkspaceTokenRail({
  currentWorkspace,
  isLoading,
  error,
  currentUserUid,
  isCurrentUser,
  getIdToken,
  hasSignedInUser,
  activeWorkspaceId,
  switchWorkspace,
  endWorkspaceSession,
  persistWorkspaceIdentity,
  clearSessionStorage,
  surfacePermanentAuthError
}: LegacyWorkspaceTokenRailDeps) {
  const workspaceToken = ref<string | null>(null)
  const workspaceTokenExpiresAt = ref<number | null>(null)
  const workspaceTokenOwnerUid = ref<string | null>(null)

  // Timer state
  let refreshTimerId: ReturnType<typeof setTimeout> | null = null
  let inFlightSwitchCount = 0
  let inFlightSwitchPromise: Promise<void> | null = null
  let recoveryCooldownUntil = 0
  let scheduledRefreshRetryCount = 0

  // Request ID to prevent stale refresh operations from overwriting newer workspace contexts
  let refreshRequestId = 0

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

  function retireLegacyToken(): void {
    stopRefreshTimer()
    workspaceToken.value = null
    workspaceTokenExpiresAt.value = null
    workspaceTokenOwnerUid.value = null
    try {
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.TOKEN)
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.EXPIRES_AT)
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEYS.OWNER_UID)
    } catch {
      console.warn(
        'Failed to retire legacy workspace token from sessionStorage'
      )
    }
  }

  function readStoredSession(): StoredSession | null {
    const workspaceJson = sessionStorage.getItem(
      WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE
    )
    const token = sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.TOKEN)
    const expiresAtStr = sessionStorage.getItem(
      WORKSPACE_STORAGE_KEYS.EXPIRES_AT
    )
    const ownerUid = sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.OWNER_UID)
    if (!workspaceJson || !token || !expiresAtStr || !ownerUid) return null
    if (!isCurrentUser(ownerUid)) return null

    const parseResult = WorkspaceIdentitySchema.safeParse(
      JSON.parse(workspaceJson)
    )
    if (!parseResult.success) return null

    return {
      workspace: parseResult.data,
      token,
      expiresAt: parseInt(expiresAtStr, 10),
      ownerUid
    }
  }

  function isUnexpiredSession({ expiresAt }: StoredSession): boolean {
    return !isNaN(expiresAt) && expiresAt > Date.now()
  }

  function initializeFromSession(): boolean {
    try {
      const session = readStoredSession()
      if (!session || !isUnexpiredSession(session)) {
        clearSessionStorage()
        return false
      }

      currentWorkspace.value = session.workspace
      workspaceToken.value = session.token
      workspaceTokenExpiresAt.value = session.expiresAt
      workspaceTokenOwnerUid.value = session.ownerUid
      error.value = null

      scheduleTokenRefresh(session.expiresAt)
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
   * it writes no store state, schedules no timer, and reads no flag.
   */
  async function requestToken(workspaceId?: string): Promise<MintedToken> {
    const ownerUid = currentUserUid()
    if (!ownerUid) throw notAuthenticatedError()

    const firebaseToken = await getIdToken()
    if (!firebaseToken) throw notAuthenticatedError()

    const response = await fetch(workspaceApiUrl('/auth/token'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workspaceId ? { workspace_id: workspaceId } : {})
    })

    if (!response.ok) {
      const { message } = await parseErrorResponse(response)
      throw tokenExchangeErrorForStatus(response.status, message)
    }

    return parseMintedToken(await response.json(), ownerUid)
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

  function switchLegacyWorkspace(workspaceId: string): Promise<void> {
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
    if (err.code === 'NOT_AUTHENTICATED' && hasSignedInUser()) {
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

  async function canRecheckAfterInFlightSwitch(
    inFlight: Promise<void>,
    ownerUid: string,
    targetWorkspaceId: string | undefined
  ): Promise<boolean> {
    await inFlight.catch(() => {})
    if (!isCurrentUser(ownerUid)) return false
    return isCloud || currentWorkspace.value?.id === targetWorkspaceId
  }

  function canStartRecoveryMint(
    targetWorkspaceId: string | undefined
  ): targetWorkspaceId is string {
    if (!targetWorkspaceId || Date.now() < recoveryCooldownUntil) return false
    return isCloud || activeWorkspaceId() === targetWorkspaceId
  }

  async function recoverWorkspaceToken(
    ownerUid: string,
    targetWorkspaceId: string | undefined
  ): Promise<string | null> {
    if (!canStartRecoveryMint(targetWorkspaceId)) return null
    try {
      await switchWorkspace(targetWorkspaceId)
    } catch (err) {
      if (isCurrentUser(ownerUid)) handleRecoveryFailure(err, targetWorkspaceId)
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

    for (;;) {
      if (!isCurrentUser(ownerUid)) return null
      if (hasValidTokenForWorkspace(targetWorkspaceId)) {
        return workspaceToken.value
      }
      if (!inFlightSwitchPromise) break

      // Join any in-flight mint and re-check rather than launching our own.
      const mayRecheck = await canRecheckAfterInFlightSwitch(
        inFlightSwitchPromise,
        ownerUid,
        targetWorkspaceId
      )
      if (!mayRecheck) return null
    }

    return recoverWorkspaceToken(ownerUid, targetWorkspaceId)
  }

  async function ensureWorkspaceAuthHeader(
    preferredWorkspaceId?: string
  ): Promise<AuthHeader | null> {
    const token = await ensureWorkspaceToken(preferredWorkspaceId)
    return token ? { Authorization: `Bearer ${token}` } : null
  }

  function endRefreshOnPermanentError(
    err: WorkspaceAuthError,
    workspaceId: string,
    capturedRequestId: number
  ): void {
    if (isStaleWorkspaceRequest(capturedRequestId)) return
    console.error('Workspace access revoked or auth invalid:', err)
    endWorkspaceSession(
      isWorkspaceSelectionInvalid(err) ? workspaceId : undefined
    )
  }

  async function waitForRefreshBackoff(
    attempt: number,
    err: unknown
  ): Promise<void> {
    const delayMs = refreshBackoffMs(attempt)
    console.warn(
      `Token refresh failed (attempt ${attempt + 1}/${REFRESH_ATTEMPT_MAX_RETRIES + 1}), retrying in ${delayMs}ms:`,
      err
    )
    await delay(delayMs)
  }

  function preserveTokenAfterExhaustedRefresh(err: unknown): void {
    error.value = null
    const retryScheduled = scheduleTokenRefreshRetry(
      refreshBackoffMs(REFRESH_ATTEMPT_MAX_RETRIES)
    )
    console.warn(
      retryScheduled
        ? 'Failed to refresh workspace token after retries; preserving existing valid token and retrying later:'
        : 'Failed to refresh workspace token after retries; preserving existing valid token until expiry:',
      err
    )
  }

  function settleExhaustedRefresh(
    err: unknown,
    capturedRequestId: number
  ): void {
    if (isStaleWorkspaceRequest(capturedRequestId)) return
    if (isTransientAuthError(err) && hasValidWorkspaceToken()) {
      preserveTokenAfterExhaustedRefresh(err)
      return
    }
    console.error('Failed to refresh workspace token after retries:', err)
    endWorkspaceSession()
  }

  async function refreshToken(): Promise<void> {
    if (!currentWorkspace.value) {
      return
    }

    const workspaceId = currentWorkspace.value.id
    const capturedRequestId = refreshRequestId
    // Clear any previous error optimistically; a stale-aborted refresh should
    // not leave a stale error visible on the new workspace's context.
    error.value = null

    for (let attempt = 0; attempt <= REFRESH_ATTEMPT_MAX_RETRIES; attempt++) {
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
        if (isPermanentAuthError(err)) {
          endRefreshOnPermanentError(err, workspaceId, capturedRequestId)
          return
        }
        if (
          isTransientAuthError(err) &&
          attempt < REFRESH_ATTEMPT_MAX_RETRIES
        ) {
          await waitForRefreshBackoff(attempt, err)
          continue
        }
        settleExhaustedRefresh(err, capturedRequestId)
        return
      }
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

  function clearLegacyContext(): void {
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
  }

  return {
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
  }
}
