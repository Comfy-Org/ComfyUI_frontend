/**
 * Shared signed-in state for the website's Vue islands, projected from the
 * @comfyorg/account session client. Firebase is loaded only after the
 * Workshop auth flag becomes true; a release-shape page does not download
 * or initialize it.
 *
 * The identity listener and focus refresh keep displayed state warm. A
 * caller that needs a token must still await `ensureFresh()` immediately
 * before use — freshness is valid-on-read, guaranteed by the client, not by
 * these warm-ups.
 */
import type { User } from 'firebase/auth'
import { computed, effectScope, readonly, ref, watch } from 'vue'

import type { AccountCredential } from '@comfyorg/account/core'

import { useWorkshopAuthFlag } from '../scripts/posthog'
import { workshopSessionClient } from './workshop-account'

export type {
  AccountCredential as WorkshopSession,
  AccountUser as WorkshopSessionUser
} from '@comfyorg/account/core'

const user = ref<User | null>(null)
const session = ref<AccountCredential | undefined>(undefined)
let started = false
let generation = 0
let detachIdentity: (() => void) | undefined
let stopSnapshot: (() => void) | undefined
let stopFocusListener: (() => void) | undefined

function stopListeners(): void {
  detachIdentity?.()
  detachIdentity = undefined
  stopSnapshot?.()
  stopSnapshot = undefined
  stopFocusListener?.()
  stopFocusListener = undefined
}

async function begin(expectedGeneration: number): Promise<void> {
  const firebase = await import('./workshop-firebase')
  if (generation !== expectedGeneration) return

  stopSnapshot = workshopSessionClient.subscribe((snapshot) => {
    user.value = snapshot.user
    session.value =
      snapshot.phase === 'authenticated' ? snapshot.session : undefined
  })
  detachIdentity = workshopSessionClient.attachIdentity({
    onUserChanged: firebase.onWorkshopUserChanged
  })

  const onFocus = () => void workshopSessionClient.ensureFresh()
  window.addEventListener('focus', onFocus)
  stopFocusListener = () => window.removeEventListener('focus', onFocus)
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  // This detached scope gives the module singleton its own lifetime instead
  // of binding its watcher to whichever component calls this first.
  const lifecycle = effectScope(true)
  const enabled = useWorkshopAuthFlag()
  lifecycle.run(() => {
    watch(
      enabled,
      (on) => {
        const expectedGeneration = ++generation
        stopListeners()
        if (!on) {
          user.value = null
          session.value = undefined
          workshopSessionClient.clearCache()
          return
        }
        void begin(expectedGeneration).catch((error: unknown) => {
          if (generation === expectedGeneration) {
            console.error('Workshop auth initialization failed', error)
          }
        })
      },
      { immediate: true }
    )
  })
}

async function signOut(): Promise<void> {
  const { signOutWorkshop } = await import('./workshop-firebase')
  await signOutWorkshop()
}

export function useWorkshopSession() {
  start()
  return {
    user: readonly(user),
    session: readonly(session),
    signedIn: computed(() => session.value !== undefined),
    ensureFresh: workshopSessionClient.ensureFresh,
    remint: workshopSessionClient.remint,
    signOut
  }
}
