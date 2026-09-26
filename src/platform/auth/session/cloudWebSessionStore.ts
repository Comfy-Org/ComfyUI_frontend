import type { User } from 'firebase/auth'
import { defineStore } from 'pinia'
import { onScopeDispose } from 'vue'

import type {
  WebSessionAccountChange,
  WebSessionIdentity,
  WebSessionIdentityState,
  WebSessionSharedMessage
} from '@comfyorg/account-core/webSessionIdentity'
import { createWebSessionIdentity } from '@comfyorg/account-core/webSessionIdentity'
import {
  createWebCrossTabRefreshPort,
  createWebVisibilityPort
} from '@comfyorg/account-core/web'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
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

function createCloudIdentity(): WebSessionIdentity {
  const visibility = createWebVisibilityPort()
  const crossTab = createWebCrossTabRefreshPort<WebSessionSharedMessage>()
  return createWebSessionIdentity({
    session: {
      apiBaseUrl: api.apiURL(''),
      fetchImpl: (input, init) => fetch(input, init)
    },
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

  onScopeDispose(() => identity?.dispose())

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

  return {
    start,
    isActive: () => identity !== null,
    whenReady: () => ready,
    signedInInteractively,
    signOut
  }
})
