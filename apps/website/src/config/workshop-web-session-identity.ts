/**
 * The header's shared web session, loaded only once the flag is on. The
 * session is read before Firebase is loaded, so a visitor the session
 * already knows costs no Firebase call.
 */
import type { User } from 'firebase/auth'
import type { Ref } from 'vue'
import { computed, readonly, shallowRef } from 'vue'

import type {
  WebSession,
  WebSessionUser
} from '@comfyorg/account-core/webSession'
import type { RememberedLogin } from '@comfyorg/account-core/webSessionIdentity'
import { createWebSessionIdentity } from '@comfyorg/account-core/webSessionIdentity'

import { workshopIdentity } from './workshop-account'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import type { WorkshopAccountSource } from './workshop-account-source'

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

const webSession = shallowRef<WebSession>()

export function useWorkshopWebSession(): Readonly<Ref<WebSession | undefined>> {
  return readonly(webSession)
}

export function useWorkshopSessionAccount(): Readonly<
  Ref<WebSessionUser | undefined>
> {
  return computed(() => webSession.value?.user)
}

/** Boots the session and answers once; returns its teardown. */
export function bootWorkshopWebSession(
  decide: (source: WorkshopAccountSource) => void
): () => void {
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
      webSession.value = state.session
      decide('session')
    } else if (state.phase === 'signed_out') {
      decide('firebase')
    }
  })
  identity.boot()
  return () => identity.dispose()
}
