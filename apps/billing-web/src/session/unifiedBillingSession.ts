/**
 * billing-web on the shared web session: identity comes from ingest's
 * session cookie. This origin's own Firebase is touched only once the session
 * has answered that there is none, to restore or sign in.
 */
import type { User } from 'firebase/auth'
import { computed, shallowRef, watch } from 'vue'

import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import type { WebSessionOptions } from '@comfyorg/account-core/webSession'
import { createWebSession } from '@comfyorg/account-core/webSession'
import type { WebSessionIdentityState } from '@comfyorg/account-core/webSessionIdentity'
import { createWebSessionIdentity } from '@comfyorg/account-core/webSessionIdentity'

import type { SignInPort } from '@/auth/useSignInController'
import type { BillingWebSessionPhase } from '@/router'

export interface UnifiedBillingSessionDeps {
  /** Ingest API root, e.g. `https://cloud.comfy.org/api`. */
  readonly apiBaseUrl: string
  readonly fetchImpl: typeof fetch
  readonly loadFirebase: () => Promise<FirebaseIdentity | undefined>
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
  // The boot asks for the remembered login after every read; a live session
  // answers it without loading this origin's Firebase.
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

  const state = shallowRef<WebSessionIdentityState>(identity.getState())
  identity.subscribe((next) => {
    state.value = next
  })

  function settledOf(): BillingWebSessionPhase | undefined {
    const current = state.value
    if (current.phase === 'signed_out' || current.phase === 'api_key') {
      return 'signed-out'
    }
    return current.phase === 'signed_in' ? 'authenticated' : undefined
  }

  /** Boots on first use and resolves once the session settles. */
  function settledPhase(): Promise<BillingWebSessionPhase> {
    identity.boot()
    return new Promise((resolve) => {
      const stop = watch(
        state,
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
    if (user === undefined) return state.value.phase === 'signed_in'
    const created = await createWebSession(session, () => user.getIdToken())
    if (created.status !== 'ok') return false
    identity.dispose()
    return (await settledPhase()) === 'authenticated'
  }

  const signInPort: SignInPort = {
    user: computed(() =>
      state.value.phase === 'signed_in' ? state.value.session.user : null
    ),
    failureCode: computed(() => undefined),
    loadIdentity: async () =>
      (await settledPhase()) === 'signed-out' ? deps.loadFirebase() : undefined,
    establish
  }

  return { settledPhase, signInPort }
}

export type UnifiedBillingSession = ReturnType<
  typeof createUnifiedBillingSession
>
