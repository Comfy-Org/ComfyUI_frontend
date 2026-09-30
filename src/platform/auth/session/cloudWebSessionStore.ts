import { until } from '@vueuse/core'
import type { User } from 'firebase/auth'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'

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

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import {
  clearInteractiveSignIn,
  markInteractiveSignIn,
  takeInteractiveSignIn
} from '@/platform/auth/session/interactiveSignInMarker'
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

type Phase = WebSessionIdentityState['phase']

const BOOTING_PHASES: ReadonlySet<Phase> = new Set([
  'idle',
  'reading',
  'restoring'
])
const UNDECIDED_PHASES: ReadonlySet<Phase> = new Set([
  ...BOOTING_PHASES,
  'retry_wait'
])
const RECONNECTING_AFTER_MS = 10_000

type TokenFailureMessageKey =
  `auth.webSession.token.${keyof (typeof enMessages)['auth']['webSession']['token']}`

const TOKEN_FAILURE_COPY: Readonly<
  Record<WebSessionErrorCode, TokenFailureMessageKey>
> = {
  NO_SESSION: 'auth.webSession.token.ended',
  SESSION_EXPIRED: 'auth.webSession.token.ended',
  SESSION_REVOKED: 'auth.webSession.token.ended',
  IDENTITY_CHANGED: 'auth.webSession.token.identityChanged',
  SESSION_UNAVAILABLE: 'auth.webSession.token.unavailable',
  CSRF_STALE: 'auth.webSession.token.refused',
  WORKSPACE_ACCESS_DENIED: 'auth.webSession.token.workspaceDenied',
  SESSION_REQUEST_REFUSED: 'auth.webSession.token.refused'
}

const LIFECYCLE_RACES: ReadonlySet<WebSessionErrorCode> = new Set([
  'NO_SESSION',
  'IDENTITY_CHANGED'
])

async function whenSettled(
  identity: WebSessionIdentity,
  unsettled: ReadonlySet<Phase>
): Promise<void> {
  let stop = () => {}
  await new Promise<void>((resolve) => {
    stop = identity.subscribe((state) => {
      if (!unsettled.has(state.phase)) resolve()
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
        signOutLocally: async () => {
          if (firebaseIdentity.currentUser()) await firebaseIdentity.signOut()
        }
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
  let creating: Promise<void> = Promise.resolve()
  let decidedForRequests: Promise<void> = Promise.resolve()
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let pendingSignIn: InteractiveSignIn | null = null
  let reread: WebSession | null = null
  let releaseRequests = () => {}
  const state = shallowRef<WebSessionIdentityState>({ phase: 'idle' })
  const signedInUser = computed(() =>
    state.value.phase === 'signed_in' ? state.value.session.user : undefined
  )

  watch(
    () =>
      signedInUser.value?.id &&
      JSON.stringify([signedInUser.value.id, teamWorkspaceId()]),
    (socketScope) => {
      if (socketScope) void api.reconnectSocket()
    }
  )

  const reconnecting = shallowRef(false)
  const readsFailing = computed(
    () => 'failures' in state.value && state.value.failures > 0
  )

  watch(readsFailing, (failing) => {
    clearTimeout(reconnectTimer)
    reconnecting.value = false
    if (failing) {
      reconnectTimer = setTimeout(() => {
        reconnecting.value = true
      }, RECONNECTING_AFTER_MS)
    }
  })

  onScopeDispose(() => {
    clearTimeout(reconnectTimer)
    releaseRequests()
    identity?.dispose()
  })

  async function createSession(
    session: WebSessionIdentity,
    getProof: () => Promise<string>
  ): Promise<void> {
    const result = await session.signedIn(getProof).catch(() => null)
    if (result?.status === 'ok') {
      clearInteractiveSignIn()
      return
    }
    reportError(new Error('Web session creation failed'), {
      surface: 'auth',
      errorType: 'session_cookie_creation_failure',
      level: 'warning'
    })
  }

  async function bootAfter(
    session: WebSessionIdentity,
    signIn: InteractiveSignIn | null
  ): Promise<void> {
    const user = firebaseIdentity.currentUser()
    const reloaded = !signIn && user && takeInteractiveSignIn(user.uid)
    const interactive =
      signIn ??
      (reloaded ? { uid: user.uid, getProof: () => user.getIdToken() } : null)
    if (interactive && interactive.uid === user?.uid) {
      await createSession(session, interactive.getProof)
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
    session.subscribe((next) => {
      reread = null
      state.value = next
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
      workspaceToken: ({ workspaceId }) => mint.mint(workspaceId),
      authorizeResource: async ({ session }) => {
        try {
          const { headers } = await authorize(
            { kind: 'session', session },
            { target: 'resource', method: 'POST' }
          )
          return headers
        } catch (error) {
          if (!(error instanceof SessionTokenError)) throw error
          const { failure } = error
          if (
            failure.httpStatus !== 401 &&
            !LIFECYCLE_RACES.has(failure.code)
          ) {
            reportError(error, {
              surface: 'auth',
              errorType: 'auth_session_token_mint_failure',
              level: 'warning',
              tags: { code: failure.code, http_status: failure.httpStatus }
            })
          }
          throw new WebSessionTokenError(
            error,
            t(TOKEN_FAILURE_COPY[failure.code])
          )
        }
      }
    })
    ready = whenSettled(session, BOOTING_PHASES)
    decidedForRequests = whenSettled(session, UNDECIDED_PHASES)
    void bootAfter(session, pendingSignIn)
    pendingSignIn = null
    return true
  }

  /** Only after an interactive sign-in; a token refresh never calls this. */
  function signedInInteractively(user: User): void {
    const getProof = () => user.getIdToken()
    if (isCloud) markInteractiveSignIn(user.uid)
    if (identity) creating = createSession(identity, getProof)
    else if (!decided) pendingSignIn = { uid: user.uid, getProof }
  }

  async function signOut(): Promise<void> {
    pendingSignIn = null
    clearInteractiveSignIn()
    const result = await identity?.signOut()
    if (result === undefined || result.status === 'ok') return
    reportError(new Error('Session cookie deletion failed'), {
      surface: 'auth',
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
    await decidedForRequests
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

  async function whenDecided(): Promise<'signed_in' | 'signed_out'> {
    await until(state).toMatch(
      ({ phase }) => phase === 'signed_in' || phase === 'signed_out'
    )
    return state.value.phase === 'signed_in' ? 'signed_in' : 'signed_out'
  }

  return {
    start,
    state,
    signedInUser,
    reconnecting,
    isActive: () => identity !== null,
    whenReady: () => ready,
    whenSessionCreated: () => creating,
    whenDecided,
    signedInInteractively,
    signOut
  }
})
