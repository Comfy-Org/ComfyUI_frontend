/**
 * Shared signed-in state for the website's Vue islands, projected from the
 * @comfyorg/account session client. Firebase is loaded only after the
 * Workshop auth flag becomes true; a release-shape page does not download
 * or initialize it.
 *
 * `settled` mirrors the client's own flag: false until Firebase has
 * delivered the restored user (or none) at least once.
 *
 * The identity listener and focus refresh keep displayed state warm. A
 * caller that needs a token must still await `ensureFresh()` immediately
 * before use — freshness is valid-on-read, guaranteed by the client, not by
 * these warm-ups.
 */
import type { User } from 'firebase/auth'
import { computed, effectScope, readonly, ref, watch } from 'vue'
import type { EffectScope } from 'vue'

import type {
  AccountCredential,
  SessionFailure
} from '@comfyorg/account/session'

import { useWorkshopAuthFlag } from '../scripts/posthog'
import {
  subscribeAuthRefreshTelemetry,
  workshopSessionClient
} from './workshop-account'

export type {
  AccountCredential as WorkshopSession,
  AccountUser as WorkshopSessionUser
} from '@comfyorg/account/session'

const user = ref<User | null>(null)
const session = ref<AccountCredential | undefined>(undefined)
const sessionFailure = ref<SessionFailure | undefined>(undefined)
const settled = ref(false)
let started = false
let lifecycle: EffectScope | undefined
let generation = 0
let detachIdentity: (() => void) | undefined
let stopSnapshot: (() => void) | undefined
let stopTelemetry: (() => void) | undefined
let stopFocusListener: (() => void) | undefined

function stopListeners(): void {
  detachIdentity?.()
  detachIdentity = undefined
  stopSnapshot?.()
  stopSnapshot = undefined
  stopTelemetry?.()
  stopTelemetry = undefined
  stopFocusListener?.()
  stopFocusListener = undefined
}

async function begin(expectedGeneration: number): Promise<void> {
  const firebase = await import('./workshop-firebase')
  if (generation !== expectedGeneration) return

  stopSnapshot = workshopSessionClient.subscribe((snapshot) => {
    user.value = snapshot.user
    settled.value = snapshot.settled
    session.value =
      snapshot.phase === 'authenticated' ? snapshot.session : undefined
    sessionFailure.value =
      snapshot.phase === 'error' ? snapshot.failure : undefined
  })
  detachIdentity = workshopSessionClient.attachIdentity(
    firebase.workshopIdentity
  )
  // Auth-refresh telemetry now starts and stops with this lifecycle instead of
  // at module load; credits/billing stay a separate consumer.
  stopTelemetry = subscribeAuthRefreshTelemetry()

  const onFocus = () => void workshopSessionClient.ensureFresh()
  window.addEventListener('focus', onFocus)
  stopFocusListener = () => window.removeEventListener('focus', onFocus)
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  // This detached scope gives the module singleton its own lifetime instead
  // of binding its watcher to whichever component calls this first.
  lifecycle = effectScope(true)
  const enabled = useWorkshopAuthFlag()
  lifecycle.run(() => {
    watch(
      enabled,
      (on, wasOn) => {
        const expectedGeneration = ++generation
        stopListeners()
        settled.value = false
        if (!on) {
          user.value = null
          session.value = undefined
          sessionFailure.value = undefined
          // The flag starts false on every cold load until PostHog answers;
          // only a real on->off transition means the credential must go.
          if (wasOn) workshopSessionClient.clearStoredCredential()
          return
        }
        void begin(expectedGeneration).catch((error: unknown) => {
          if (generation !== expectedGeneration) return
          console.error('Workshop auth initialization failed', error)
          // Nothing half-installed survives, and the latch opens again so
          // the next caller retries instead of waiting out the timeout.
          stopListeners()
          lifecycle?.stop()
          lifecycle = undefined
          started = false
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
    // Lets consumers tell "mint legitimately in flight" from "the last
    // mint failed" instead of error-styling ordinary latency.
    sessionFailure: readonly(sessionFailure),
    settled: readonly(settled),
    signedIn: computed(() => session.value !== undefined),
    ensureFresh: workshopSessionClient.ensureFresh,
    remint: workshopSessionClient.remint,
    signOut
  }
}
