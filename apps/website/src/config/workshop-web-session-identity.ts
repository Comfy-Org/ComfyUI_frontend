/**
 * Which identity the header shows: the shared web session, or the Firebase
 * lifecycle it shows today. Flag off, the answer is Firebase after the one
 * probe GET. Flag on, the session is read before Firebase is loaded, so a
 * visitor the session already knows costs no Firebase call.
 */
import type { User } from 'firebase/auth'
import type { Ref } from 'vue'
import { readonly, shallowRef } from 'vue'

import type { WebSessionUser } from '@comfyorg/account-core/webSession'
import type { RememberedLogin } from '@comfyorg/account-core/webSessionIdentity'
import { createWebSessionIdentity } from '@comfyorg/account-core/webSessionIdentity'

import { workshopIdentity } from './workshop-account'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import { readUnifiedWebSessionEnabled } from './workshop-web-session'

export type WorkshopAccountSource = 'session' | 'firebase'

/** The Firebase user only if the lifecycle already loaded one; never loads it. */
function loadedFirebaseUser(): User | null {
  const seen: { user: User | null } = { user: null }
  workshopIdentity.onUserChanged((user) => {
    seen.user = user
  })()
  return seen.user
}

/**
 * The Comfy user id is the Firebase uid. An unloaded Firebase answers null,
 * which the boot reads as nothing remembered: no silent restore and no local
 * sign-out on this page load.
 */
const rememberedWorkshopLogin: RememberedLogin = {
  currentUserId: async () => loadedFirebaseUser()?.uid ?? null,
  getProof: async () => (await loadedFirebaseUser()?.getIdToken()) ?? null,
  signOutLocally: async () => {
    const { signOutWorkshop } = await import('./workshop-firebase')
    await signOutWorkshop()
  }
}

const sessionUser = shallowRef<WebSessionUser>()

export function useWorkshopSessionAccount(): Readonly<
  Ref<WebSessionUser | undefined>
> {
  return readonly(sessionUser)
}

function bootWebSession(): Promise<WorkshopAccountSource> {
  return new Promise((resolve) => {
    const identity = createWebSessionIdentity({
      session: {
        apiBaseUrl: `${WORKSHOP_CLOUD_BASE_URL}/api`,
        fetchImpl: (...args: Parameters<typeof fetch>) =>
          globalThis.fetch(...args)
      },
      principal: { kind: 'account', rememberedLogin: rememberedWorkshopLogin },
      origin: window.location.origin
    })
    identity.subscribe((state) => {
      if (state.phase === 'signed_in') {
        sessionUser.value = state.session.user
        resolve('session')
      } else if (state.phase === 'signed_out') {
        resolve('firebase')
      }
    })
    identity.boot()
  })
}

let resolution: Promise<WorkshopAccountSource> | undefined

/** Settles once per page load; a session still retrying keeps it pending. */
export function resolveWorkshopAccountSource(): Promise<WorkshopAccountSource> {
  resolution ??= readUnifiedWebSessionEnabled().then((enabled) =>
    enabled ? bootWebSession() : 'firebase'
  )
  return resolution
}
