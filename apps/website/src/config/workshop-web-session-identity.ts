/**
 * Which identity the header shows: the shared web session, or the Firebase
 * lifecycle it shows today. Flag off, the answer is Firebase after the one
 * probe GET. Flag on, the session is read before Firebase is loaded, so a
 * visitor the session already knows costs no Firebase call.
 */
import type { User } from 'firebase/auth'
import type { Ref } from 'vue'
import { computed, readonly, shallowRef } from 'vue'

import type {
  WebSession,
  WebSessionUser
} from '@comfyorg/account-core/webSession'
import type {
  RememberedLogin,
  WebSessionIdentity
} from '@comfyorg/account-core/webSessionIdentity'

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

const webSession = shallowRef<WebSession>()

export function useWorkshopWebSession(): Readonly<Ref<WebSession | undefined>> {
  return readonly(webSession)
}

export function useWorkshopSessionAccount(): Readonly<
  Ref<WebSessionUser | undefined>
> {
  return computed(() => webSession.value?.user)
}

/** Past this, the Firebase header mounts for the page load and never swaps. */
export const ACCOUNT_SOURCE_CAP_MS = 800

async function createWorkshopWebSessionIdentity(): Promise<WebSessionIdentity> {
  const { createWebSessionIdentity } =
    await import('@comfyorg/account-core/webSessionIdentity')
  return createWebSessionIdentity({
    session: {
      apiBaseUrl: `${WORKSHOP_CLOUD_BASE_URL}/api`,
      fetchImpl: (...args: Parameters<typeof fetch>) =>
        globalThis.fetch(...args)
    },
    principal: { kind: 'account', rememberedLogin: rememberedWorkshopLogin },
    origin: window.location.origin
  })
}

function decideAccountSource(): Promise<WorkshopAccountSource> {
  return new Promise((resolve) => {
    let capped = false
    let identity: WebSessionIdentity | undefined
    const cap = setTimeout(() => {
      capped = true
      identity?.dispose()
      resolve('firebase')
    }, ACCOUNT_SOURCE_CAP_MS)
    const decide = (source: WorkshopAccountSource) => {
      clearTimeout(cap)
      resolve(source)
    }
    void readUnifiedWebSessionEnabled()
      .then((enabled) => {
        if (capped) return undefined
        if (!enabled) {
          decide('firebase')
          return undefined
        }
        return createWorkshopWebSessionIdentity()
      })
      .then((created) => {
        if (!created) return
        if (capped) return created.dispose()
        identity = created
        identity.subscribe((state) => {
          if (state.phase === 'signed_in') {
            webSession.value = state.session
            decide('session')
          } else if (state.phase === 'signed_out') {
            decide('firebase')
          }
        })
        identity.boot()
      })
  })
}

let resolution: Promise<WorkshopAccountSource> | undefined

/** Settles once per page load, at the latest when the cap fires. */
export function resolveWorkshopAccountSource(): Promise<WorkshopAccountSource> {
  resolution ??= decideAccountSource()
  return resolution
}
