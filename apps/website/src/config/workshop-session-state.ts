/**
 * Shared signed-in state for the website's Vue islands, projected from the
 * @comfyorg/account session client. Firebase is loaded only after the
 * Workshop auth flag becomes true; a release-shape page does not download
 * or initialize it.
 *
 * One `SessionSnapshot` ref is the single source of truth; the views below
 * derive from it, so the illegal combinations a set of parallel refs could
 * hold cannot occur. `phase === 'pending'` is "Firebase has not answered
 * yet", distinct from a signed-out `null`.
 *
 * The identity listener and focus refresh keep displayed state warm. A
 * caller that needs a token must still await `ensureFresh()` immediately
 * before use — freshness is valid-on-read, guaranteed by the client, not by
 * these warm-ups.
 */
import { z } from 'zod'

import type { User } from 'firebase/auth'
import { computed, effectScope, shallowRef, watch } from 'vue'
import type { EffectScope } from 'vue'

import type { SessionSnapshot } from '@comfyorg/account/session'

import { useWorkshopAuthFlag } from '../scripts/posthog'
import {
  subscribeAuthRefreshTelemetry,
  workshopSessionClient
} from './workshop-account'

export type {
  AccountCredential as WorkshopSession,
  AccountUser as WorkshopSessionUser
} from '@comfyorg/account/session'

const PENDING: SessionSnapshot<User> = {
  phase: 'pending',
  user: null,
  session: undefined
}

const snapshot = shallowRef<SessionSnapshot<User>>(PENDING)
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

// A refresh that means "keep my session fresh" must keep the workspace the
// session is in: a target-less mint resolves the personal workspace, which
// reads as the account silently switching itself.
function currentWorkspaceId(): string | undefined {
  const current = snapshot.value
  return current.phase === 'authenticated'
    ? current.session.workspace.id
    : undefined
}

const ensureFreshHere: typeof workshopSessionClient.ensureFresh = (
  user,
  options
) =>
  workshopSessionClient.ensureFresh(user, {
    workspaceId: currentWorkspaceId(),
    ...options
  })

/**
 * The exchange resolves a target-less boot mint to the personal workspace
 * by design, so the chosen workspace must be the site's memory: written on
 * every authenticated snapshot, restored with one targeted re-mint on the
 * first snapshot after a reload, and dropped if that restore is refused.
 */
const REMEMBERED_WORKSPACE_KEY = 'workshop:workspace'

const zRememberedWorkspace = z.object({
  uid: z.string(),
  workspaceId: z.string()
})

function rememberedWorkspace(uid: string): string | undefined {
  try {
    const raw = window.localStorage.getItem(REMEMBERED_WORKSPACE_KEY)
    if (!raw) return undefined
    const parsed = zRememberedWorkspace.safeParse(JSON.parse(raw))
    return parsed.success && parsed.data.uid === uid
      ? parsed.data.workspaceId
      : undefined
  } catch {
    return undefined
  }
}

function rememberWorkspace(uid: string, workspaceId: string | undefined): void {
  try {
    if (workspaceId)
      window.localStorage.setItem(
        REMEMBERED_WORKSPACE_KEY,
        JSON.stringify({ uid, workspaceId })
      )
    else window.localStorage.removeItem(REMEMBERED_WORKSPACE_KEY)
  } catch {
    /* storage may be unavailable; the workspace just does not persist */
  }
}

let restoredForUid: string | undefined

function keepWorkspaceRemembered(): void {
  const current = snapshot.value
  if (current.phase !== 'authenticated') return
  const { uid, workspace } = current.session
  if (restoredForUid !== uid) {
    restoredForUid = uid
    const remembered = rememberedWorkspace(uid)
    if (remembered && remembered !== workspace.id) {
      void workshopSessionClient
        .remint(undefined, { workspaceId: remembered })
        .then((result) => {
          if (result?.status !== 'ok') rememberWorkspace(uid, undefined)
        })
      return
    }
  }
  rememberWorkspace(uid, workspace.id)
}

async function begin(expectedGeneration: number): Promise<void> {
  const firebase = await import('./workshop-firebase')
  if (generation !== expectedGeneration) return

  stopSnapshot = workshopSessionClient.subscribe((next) => {
    snapshot.value = next
    keepWorkspaceRemembered()
  })
  detachIdentity = workshopSessionClient.attachIdentity(
    firebase.workshopIdentity
  )
  // Auth-refresh telemetry starts and stops with this lifecycle; credits and
  // billing stay a separate consumer.
  stopTelemetry = subscribeAuthRefreshTelemetry()

  const onFocus = () => void ensureFreshHere()
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
        snapshot.value = PENDING
        if (!on) {
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
    user: computed(() => snapshot.value.user),
    session: computed(() =>
      snapshot.value.phase === 'authenticated'
        ? snapshot.value.session
        : undefined
    ),
    // Lets consumers tell "mint legitimately in flight" from "the last mint
    // failed" instead of error-styling ordinary latency.
    sessionFailure: computed(() =>
      snapshot.value.phase === 'error' ? snapshot.value.failure : undefined
    ),
    settled: computed(() => snapshot.value.phase !== 'pending'),
    signedIn: computed(() => snapshot.value.phase === 'authenticated'),
    ensureFresh: ensureFreshHere,
    remint: workshopSessionClient.remint,
    signOut
  }
}
