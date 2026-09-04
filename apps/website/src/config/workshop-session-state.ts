/**
 * The session shared between islands — the header account control and the
 * playground live in different islands, but Astro dedupes this module into
 * one chunk per page, so this module scope is the bus between them (the same
 * mechanism workshop-credentials-state already relies on).
 *
 * Nothing here runs — no Firebase listener, no chunk — until the auth flag
 * is on, so a flag-off page is byte-identical to the site before sign-in
 * existed. The listeners only keep the DISPLAYED state warm: anything that
 * spends the token awaits `ensureFresh()` at the moment of use (ADR 0011);
 * a stale ref can cost a repaint, never a failed run.
 */
import type { User } from 'firebase/auth'
import { computed, readonly, ref, watch } from 'vue'

import { useWorkshopAuthFlag } from '../scripts/posthog'
import { onWorkshopUserChanged, signOutWorkshop } from './workshop-firebase'
import type { WorkshopSession, WorkshopSessionResult } from './workshop-session'
import {
  clearWorkshopSession,
  ensureFreshWorkshopSession,
  remintWorkshopSession
} from './workshop-session'

const user = ref<User | null>(null)
const session = ref<WorkshopSession | undefined>(undefined)
let started = false

async function refreshWith(
  mint: typeof ensureFreshWorkshopSession
): Promise<WorkshopSessionResult | undefined> {
  const currentUser = user.value
  if (!currentUser) return undefined
  const result = await mint(currentUser)
  // A user switch while the mint was in flight: the result belongs to the
  // previous user and must not be published.
  if (user.value?.uid !== currentUser.uid) return undefined
  if (result.status === 'ok') session.value = result.session
  return result
}

const ensureFresh = () => refreshWith(ensureFreshWorkshopSession)
/** Cache-bypassing mint — the one 401 retry a run is allowed. */
const remint = () => refreshWith(remintWorkshopSession)

function begin(): void {
  onWorkshopUserChanged((nextUser) => {
    user.value = nextUser
    if (!nextUser) {
      session.value = undefined
      clearWorkshopSession()
      return
    }
    void ensureFresh()
  })
  window.addEventListener('focus', () => {
    void ensureFresh()
  })
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  const enabled = useWorkshopAuthFlag()
  if (enabled.value) {
    begin()
    return
  }
  const stop = watch(enabled, (on) => {
    if (!on) return
    stop()
    begin()
  })
}

export function useWorkshopSession() {
  start()
  return {
    user: readonly(user),
    session: readonly(session),
    signedIn: computed(() => session.value !== undefined),
    ensureFresh,
    remint,
    signOut: signOutWorkshop
  }
}
