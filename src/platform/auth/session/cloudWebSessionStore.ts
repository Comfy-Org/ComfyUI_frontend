import type { User } from 'firebase/auth'
import { defineStore } from 'pinia'
import { onScopeDispose, shallowRef, watch } from 'vue'

import type {
  WebSessionAccountChange,
  WebSessionIdentity,
  WebSessionIdentityState,
  WebSessionSharedMessage
} from '@comfyorg/account-core/webSessionIdentity'
import type {
  WebSession,
  WebSessionErrorCode,
  WebSessionOptions
} from '@comfyorg/account-core/webSession'
import type { RequestAuthorizer } from '@comfyorg/account-core/requestAuth'
import { createRequestAuthorizer } from '@comfyorg/account-core/requestAuth'
import {
  createSessionTokenMint,
  SessionTokenError
} from '@comfyorg/account-core/sessionTokenMint'
import { readWebSession } from '@comfyorg/account-core/webSession'
import { createWebSessionIdentity } from '@comfyorg/account-core/webSessionIdentity'
import {
  createWebCrossTabRefreshPort,
  createWebVisibilityPort
} from '@comfyorg/account-core/web'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import type { WebSessionRequestScope } from '@/platform/auth/session/webSessionFetch'
import {
  fetchOnWebSession,
  provideWebSessionRequests,
  WebSessionTokenError
} from '@/platform/auth/session/webSessionFetch'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { api } from '@/scripts/api'

interface InteractiveSignIn {
  readonly uid: string
  readonly getProof: () => Promise<string>
}

const UNSETTLED_PHASES: ReadonlySet<WebSessionIdentityState['phase']> = new Set(
  ['idle', 'reading', 'restoring']
)

const TOKEN_FAILURE_COPY: Readonly<Record<WebSessionErrorCode, string>> = {
  NO_SESSION: 'auth.webSession.token.ended',
  SESSION_EXPIRED: 'auth.webSession.token.ended',
  SESSION_REVOKED: 'auth.webSession.token.ended',
  IDENTITY_CHANGED: 'auth.webSession.token.ended',
  SESSION_UNAVAILABLE: 'auth.webSession.token.unavailable',
  CSRF_STALE: 'auth.webSession.token.refused',
  WORKSPACE_ACCESS_DENIED: 'auth.webSession.token.refused',
  SESSION_REQUEST_REFUSED: 'auth.webSession.token.refused'
}

function localizeTokenFailure(error: unknown): unknown {
  if (!(error instanceof SessionTokenError)) return error
  const { failure } = error
  if (failure.httpStatus !== 401) {
    reportError(error, {
      errorType: 'auth_session_token_mint_failure',
      level: 'warning',
      tags: { code: failure.code, http_status: failure.httpStatus }
    })
  }
  return new WebSessionTokenError(failure, t(TOKEN_FAILURE_COPY[failure.code]))
}

async function whenSettled(identity: WebSessionIdentity): Promise<void> {
  let stop = () => {}
  await new Promise<void>((resolve) => {
    stop = identity.subscribe((state) => {
      if (!UNSETTLED_PHASES.has(state.phase)) resolve()
    })
  })
  stop()
}

function resetForAccountChange(change: WebSessionAccountChange): void {
  useWorkspaceAuthStore().clearWorkspaceContext()
  useTeamWorkspaceStore().resetForIdentityChange()
  void api.resetSocket()
  if (change.reason !== 'user_changed') return
  useToastStore().add({
    severity: 'info',
    summary: t('auth.accountChanged.title'),
    detail: t('auth.accountChanged.detail', {
      email: change.session.user.email
    }),
    life: 8000
  })
}

function teamWorkspaceId(): string | undefined {
  const workspace = useWorkspaceAuthStore().currentWorkspace
  return workspace?.type === 'team' ? workspace.id : undefined
}

function sessionOptions(): WebSessionOptions {
  return {
    apiBaseUrl: api.apiURL(''),
    fetchImpl: (input, init) => fetch(input, init)
  }
}

function createCloudIdentity(): WebSessionIdentity {
  const visibility = createWebVisibilityPort()
  const crossTab = createWebCrossTabRefreshPort<WebSessionSharedMessage>()
  return createWebSessionIdentity({
    session: sessionOptions(),
    principal: {
      kind: 'account',
      rememberedLogin: {
        currentUserId: async () => firebaseIdentity.currentUser()?.uid ?? null,
        getProof: async () =>
          (await firebaseIdentity.currentUser()?.getIdToken()) ?? null,
        signOutLocally: () => firebaseIdentity.signOut()
      }
    },
    origin: window.location.origin,
    onAccountChanged: resetForAccountChange,
    ...(visibility && {
      heartbeat: { visibility, ...(crossTab && { crossTab }) }
    })
  })
}

/**
 * The cloud app's side of the shared web session. `unified_web_session` is
 * read once, on the first `start()`, and decides the whole page load.
 */
export const useCloudWebSessionStore = defineStore('cloudWebSession', () => {
  let decided = false
  let identity: WebSessionIdentity | null = null
  let ready: Promise<void> = Promise.resolve()
  let pendingSignIn: InteractiveSignIn | null = null
  let reread: WebSession | null = null
  let releaseRequests = () => {}
  const signedInUserId = shallowRef<string>()

  watch(
    () =>
      signedInUserId.value &&
      JSON.stringify([signedInUserId.value, teamWorkspaceId()]),
    (socketScope) => {
      if (socketScope) void api.reconnectSocket()
    }
  )

  onScopeDispose(() => {
    releaseRequests()
    identity?.dispose()
  })

  async function createSession(
    session: WebSessionIdentity,
    getProof: () => Promise<string>
  ): Promise<void> {
    const result = await session.signedIn(getProof).catch(() => null)
    if (result?.status === 'ok') return
    reportError(new Error('Web session creation failed'), {
      errorType: 'session_cookie_creation_failure',
      level: 'warning'
    })
  }

  async function bootAfter(
    session: WebSessionIdentity,
    signIn: InteractiveSignIn | null
  ): Promise<void> {
    if (signIn && signIn.uid === firebaseIdentity.currentUser()?.uid) {
      await createSession(session, signIn.getProof)
    }
    session.boot()
  }

  /** Decides the flag for this page load; true when the session is on. */
  function start(): boolean {
    if (decided) return identity !== null
    decided = true
    if (!useFeatureFlags().flags.unifiedWebSessionEnabled) return false
    const session = createCloudIdentity()
    identity = session
    session.subscribe((state) => {
      reread = null
      signedInUserId.value =
        state.phase === 'signed_in' ? state.session.user.id : undefined
    })
    const mint = createSessionTokenMint({
      ...sessionOptions(),
      getSession: currentSession
    })
    const authorize = createRequestAuthorizer({
      getWorkspaceToken: mint.getWorkspaceToken
    })
    releaseRequests = provideWebSessionRequests({
      scope: requestScope,
      workspaceId: () => (currentSession() ? teamWorkspaceId() : undefined),
      send: (url, init, scope) => send(url, init, scope, authorize),
      authorizeResource: async ({ session }) => {
        try {
          const { headers } = await authorize(
            { kind: 'session', session },
            { target: 'resource', method: 'POST' }
          )
          return headers
        } catch (error) {
          throw localizeTokenFailure(error)
        }
      }
    })
    ready = whenSettled(session)
    void bootAfter(session, pendingSignIn)
    pendingSignIn = null
    return true
  }

  /** Only after an interactive sign-in; a token refresh never calls this. */
  function signedInInteractively(user: User): void {
    const getProof = () => user.getIdToken()
    if (identity) void createSession(identity, getProof)
    else if (!decided) pendingSignIn = { uid: user.uid, getProof }
  }

  async function signOut(): Promise<void> {
    pendingSignIn = null
    const result = await identity?.signOut()
    if (result === undefined || result.status === 'ok') return
    reportError(new Error('Session cookie deletion failed'), {
      errorType: 'auth_session_cookie_delete_failed',
      level: 'error'
    })
  }

  function currentSession(): WebSession | undefined {
    const state = identity?.getState()
    if (state?.phase !== 'signed_in') return undefined
    return reread?.user.id === state.session.user.id ? reread : state.session
  }

  /** Undefined unless this tab is signed in on the session. */
  async function requestScope(): Promise<WebSessionRequestScope | undefined> {
    await ready
    const session = currentSession()
    if (!identity || !session) return undefined
    const workspaceId = teamWorkspaceId()
    return {
      session,
      epoch: identity.getEpoch(),
      ...(workspaceId && { workspaceId })
    }
  }

  async function rereadFor(
    scope: WebSessionRequestScope
  ): Promise<WebSessionRequestScope | undefined> {
    const result = await readWebSession(sessionOptions(), {
      expectedUserId: scope.session.user.id
    })
    if (result.status !== 'ok' || identity?.getEpoch() !== scope.epoch) return
    reread = result.session
    return { ...scope, session: result.session }
  }

  function send(
    url: string,
    init: RequestInit,
    scope: WebSessionRequestScope,
    authorize: RequestAuthorizer
  ): Promise<Response> {
    return fetchOnWebSession(url, init, scope, {
      authorize,
      reread: rereadFor,
      workspaceDenied: (workspaceId) =>
        useWorkspaceAuthStore().dropDeniedWorkspace(workspaceId)
    })
  }

  return {
    start,
    isActive: () => identity !== null,
    whenReady: () => ready,
    signedInInteractively,
    signOut
  }
})
