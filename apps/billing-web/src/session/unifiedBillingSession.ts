/**
 * billing-web on the shared web session: identity comes from ingest's
 * session cookie, and the workspace from `GET /workspaces/current` under the
 * entry's workspace header. This origin's own Firebase is touched only once
 * the session has answered that there is none, to restore or sign in.
 */
import type { CurrentWorkspaceResponse } from '@comfyorg/ingest-types'
import {
  zCurrentWorkspaceResponse,
  zErrorResponse
} from '@comfyorg/ingest-types/zod'
import type { User } from 'firebase/auth'
import { computed, shallowRef, watch } from 'vue'

import type {
  BillingScope,
  BillingScopeSource,
  CredentialedWebSession
} from '@comfyorg/account-core/billing'
import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import { createRequestAuthorizer } from '@comfyorg/account-core/requestAuth'
import type { SessionErrorCode } from '@comfyorg/account-core/session'
import type {
  WebSession,
  WebSessionOptions
} from '@comfyorg/account-core/webSession'
import {
  createWebSession,
  readWebSession
} from '@comfyorg/account-core/webSession'
import type { WebSessionIdentityState } from '@comfyorg/account-core/webSessionIdentity'
import { createWebSessionIdentity } from '@comfyorg/account-core/webSessionIdentity'

import type { SignInPort } from '@/auth/useSignInController'
import type { BillingWebSessionPhase } from '@/router'

export interface UnifiedBillingSessionDeps {
  /** Ingest API root, e.g. `https://cloud.comfy.org/api`. */
  readonly apiBaseUrl: string
  readonly fetchImpl: typeof fetch
  readonly loadFirebase: () => Promise<FirebaseIdentity | undefined>
  /** The entry-bound workspace, read live; absent means personal. */
  readonly workspaceId: () => string | undefined
}

type WorkspaceResolution =
  | { readonly status: 'ok'; readonly workspace: CurrentWorkspaceResponse }
  | { readonly status: 'error'; readonly code: SessionErrorCode }

const REFUSALS: Readonly<Partial<Record<string, SessionErrorCode>>> = {
  workspace_access_denied: 'ACCESS_DENIED',
  workspace_id_invalid: 'WORKSPACE_NOT_FOUND'
}

async function refusalCode(response: Response): Promise<SessionErrorCode> {
  if (response.status === 401) return 'NOT_AUTHENTICATED'
  const body = zErrorResponse.safeParse(await response.json().catch(() => 0))
  return (body.success && REFUSALS[body.data.code]) || 'TOKEN_EXCHANGE_FAILED'
}

function restoredUser(identity: FirebaseIdentity): Promise<User | null> {
  return new Promise((resolve) => {
    const stop = identity.onUserChanged((user) => {
      resolve(user)
      queueMicrotask(() => stop())
    })
  })
}

export function createUnifiedBillingSession(deps: UnifiedBillingSessionDeps) {
  let sessionLive = false
  const session: WebSessionOptions = {
    apiBaseUrl: deps.apiBaseUrl,
    fetchImpl: async (input, init) => {
      const response = await deps.fetchImpl(input, init)
      if (init?.method === 'GET') sessionLive = response.ok
      return response
    }
  }
  const firebaseUser = async () => {
    const identity = await deps.loadFirebase()
    return identity ? restoredUser(identity) : null
  }
  const identity = createWebSessionIdentity({
    session,
    origin: globalThis.location.origin,
    principal: {
      kind: 'account',
      rememberedLogin: {
        currentUserId: async () =>
          sessionLive ? null : ((await firebaseUser())?.uid ?? null),
        getProof: async () =>
          (await (await firebaseUser())?.getIdToken()) ?? null,
        signOutLocally: async () => (await deps.loadFirebase())?.signOut()
      }
    }
  })
  const authorize = createRequestAuthorizer({
    getWorkspaceToken: () =>
      Promise.reject(new Error('billing-web never mints a workspace token'))
  })

  const state = shallowRef<WebSessionIdentityState>(identity.getState())
  const workspace = shallowRef<WorkspaceResolution>()
  let resolving: Promise<WorkspaceResolution> | undefined

  async function fetchWorkspace(
    current: WebSession
  ): Promise<WorkspaceResolution> {
    try {
      const auth = await authorize(
        { kind: 'session', session: current },
        { target: 'ingest', method: 'GET', workspaceId: deps.workspaceId() }
      )
      const response = await deps.fetchImpl(
        `${deps.apiBaseUrl}/workspaces/current`,
        { ...auth, cache: 'no-store' }
      )
      if (!response.ok) {
        return { status: 'error', code: await refusalCode(response) }
      }
      const parsed = zCurrentWorkspaceResponse.safeParse(await response.json())
      return parsed.success
        ? { status: 'ok', workspace: parsed.data }
        : { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    } catch {
      return { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    }
  }

  async function resolveWorkspace(): Promise<WorkspaceResolution> {
    const current = state.value
    if (current.phase !== 'signed_in') {
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }
    const request = fetchWorkspace(current.session)
    resolving = request
    const result = await request
    if (resolving === request && state.value === current) {
      workspace.value = result
    }
    return result
  }

  identity.subscribe((next) => {
    state.value = next
    workspace.value = undefined
    if (next.phase === 'signed_in') void resolveWorkspace()
  })

  function settledOf(): BillingWebSessionPhase | undefined {
    const current = state.value
    if (current.phase === 'signed_out' || current.phase === 'api_key') {
      return 'signed-out'
    }
    if (current.phase !== 'signed_in' || workspace.value === undefined) {
      return undefined
    }
    return workspace.value.status === 'ok' ? 'authenticated' : 'error'
  }

  /** Boots on first use and resolves once the session and workspace settle. */
  function settledPhase(): Promise<BillingWebSessionPhase> {
    identity.boot()
    return new Promise((resolve) => {
      const stop = watch(
        [state, workspace],
        () => {
          const phase = settledOf()
          if (phase === undefined) return
          resolve(phase)
          queueMicrotask(() => stop())
        },
        { immediate: true, flush: 'sync' }
      )
    })
  }

  async function establish(user?: User): Promise<boolean> {
    if (user === undefined) return (await resolveWorkspace()).status === 'ok'
    const created = await createWebSession(session, () => user.getIdToken())
    if (created.status !== 'ok') return false
    identity.dispose()
    return (await settledPhase()) === 'authenticated'
  }

  const scope = computed<BillingScope | undefined>(() => {
    const current = state.value
    const resolved = workspace.value
    if (current.phase !== 'signed_in' || resolved?.status !== 'ok') {
      return undefined
    }
    return {
      userId: current.session.user.id,
      workspaceId: resolved.workspace.id,
      role: resolved.workspace.role ?? 'member'
    }
  })

  const scopeSource: BillingScopeSource = {
    getScope: () => scope.value,
    subscribe: (listener) => watch(scope, () => listener(), { flush: 'sync' })
  }

  const webSession: CredentialedWebSession = {
    authorize,
    getSession: () =>
      state.value.phase === 'signed_in' ? state.value.session : undefined,
    readSession: ({ expectedUserId, signal }) =>
      readWebSession({ ...session, signal }, { expectedUserId })
  }

  const signInPort: SignInPort = {
    user: computed(() =>
      state.value.phase === 'signed_in' ? state.value.session.user : null
    ),
    failureCode: computed(() =>
      workspace.value?.status === 'error' ? workspace.value.code : undefined
    ),
    loadIdentity: async () =>
      (await settledPhase()) === 'signed-out' ? deps.loadFirebase() : undefined,
    establish
  }

  return {
    fetchImpl: deps.fetchImpl,
    settledPhase,
    livePhase: computed(settledOf),
    resolveWorkspace,
    scopeSource,
    webSession,
    signInPort,
    billedScope: computed(() => {
      const resolved = workspace.value
      const userId = scope.value?.userId
      return userId !== undefined && resolved?.status === 'ok'
        ? { uid: userId, workspace: resolved.workspace }
        : undefined
    })
  }
}

export type UnifiedBillingSession = ReturnType<
  typeof createUnifiedBillingSession
>
