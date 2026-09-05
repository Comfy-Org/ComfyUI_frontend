/**
 * Shared signed-in state for the website's Vue islands. Firebase is loaded
 * only after the Workshop auth flag becomes true; a release-shape page does
 * not download or initialize it.
 *
 * The listener and focus refresh keep displayed state warm. A caller that
 * needs a token must still await `ensureFresh()` immediately before use.
 */
import type { User } from 'firebase/auth'
import { computed, readonly, ref, watch } from 'vue'

import { useWorkshopAuthFlag } from '../scripts/posthog'
import type { WorkshopSession, WorkshopSessionResult } from './workshop-session'
import type { WorkshopSessionUser } from './workshop-session'
import {
  clearWorkshopSession,
  ensureFreshWorkshopSession,
  remintWorkshopSession
} from './workshop-session'

const user = ref<User | null>(null)
const session = ref<WorkshopSession | undefined>(undefined)
let started = false
let generation = 0
let stopUserListener: (() => void) | undefined
let stopFocusListener: (() => void) | undefined

async function refreshWith(
  mint: typeof ensureFreshWorkshopSession,
  requestedUser?: WorkshopSessionUser
): Promise<WorkshopSessionResult | undefined> {
  const currentUser = requestedUser ?? user.value
  if (!currentUser) return undefined

  const result = await mint(currentUser)
  // A listener-observed user switch invalidates even a popup-started mint.
  // With no requested user, sign-out also invalidates the result.
  if (
    user.value?.uid !== currentUser.uid &&
    (!requestedUser || user.value !== null)
  ) {
    return undefined
  }
  session.value = result.status === 'ok' ? result.session : undefined
  return result
}

const ensureFresh = (requestedUser?: WorkshopSessionUser) =>
  refreshWith(ensureFreshWorkshopSession, requestedUser)
const remint = (requestedUser?: WorkshopSessionUser) =>
  refreshWith(remintWorkshopSession, requestedUser)

function stopListeners(): void {
  stopUserListener?.()
  stopUserListener = undefined
  stopFocusListener?.()
  stopFocusListener = undefined
}

async function begin(expectedGeneration: number): Promise<void> {
  const firebase = await import('./workshop-firebase')
  if (generation !== expectedGeneration) return

  stopUserListener = firebase.onWorkshopUserChanged((nextUser) => {
    user.value = nextUser
    session.value = undefined
    if (!nextUser) {
      clearWorkshopSession()
      return
    }
    void ensureFresh(nextUser)
  })

  const onFocus = () => void ensureFresh()
  window.addEventListener('focus', onFocus)
  stopFocusListener = () => window.removeEventListener('focus', onFocus)
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  const enabled = useWorkshopAuthFlag()
  watch(
    enabled,
    (on) => {
      const expectedGeneration = ++generation
      stopListeners()
      if (!on) {
        user.value = null
        session.value = undefined
        clearWorkshopSession()
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
    ensureFresh,
    remint,
    signOut
  }
}
