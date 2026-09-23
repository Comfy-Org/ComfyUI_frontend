import type { OperationHandle } from '@comfyorg/account-core/boundedOperation'
import { createBoundedOperation } from '@comfyorg/account-core/boundedOperation'
import type { SessionSnapshot } from '@comfyorg/account-core/session'
import { isPermanentSessionError } from '@comfyorg/account-core/session'
import { createLifecycleScope } from '@comfyorg/account-ui/auth/lifecycleScope'
import type { User } from 'firebase/auth'
import { computed, shallowRef, watch } from 'vue'
/**
 * Shared signed-in state for the website's Vue islands, projected from the
 * @comfyorg/account-core session client.
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

import { identifyWorkshopUser, useWorkshopAuthFlag } from '../scripts/posthog'
import {
  subscribeAuthRefreshTelemetry,
  workshopIdentity,
  workshopSessionClient
} from './workshop-account'

export type {
  AccountCredential as WorkshopSession,
  AccountUser as WorkshopSessionUser
} from '@comfyorg/account-core/session'

const PENDING: SessionSnapshot<User> = {
  phase: 'pending',
  user: null,
  session: undefined
}

const snapshot = shallowRef<SessionSnapshot<User>>(PENDING)
let running = false
const lifecycle = createLifecycleScope()
const operation = createBoundedOperation()
let stopSnapshot: (() => void) | undefined
let stopTelemetry: (() => void) | undefined
let stopFocusListener: (() => void) | undefined

function stopListeners(): void {
  running = false
  // deactivate() publishes a signed-out frame; the host must be unsubscribed first.
  stopSnapshot?.()
  stopSnapshot = undefined
  workshopIdentity.deactivate()
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
    : current.user
      ? rememberedWorkspace(current.user.uid)
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
export const REMEMBERED_WORKSPACE_KEY = 'workshop:workspace'

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

type AuthenticatedSnapshot = Extract<
  SessionSnapshot<User>,
  { phase: 'authenticated' }
>

function publishTransientWorkspaceRestore(
  next: AuthenticatedSnapshot,
  live: SessionSnapshot<User>
): void {
  if (live.phase !== 'authenticated') return
  if (live.session.workspace.id === next.session.workspace.id)
    snapshot.value = live
}

async function recoverPersonalWorkspace(
  next: AuthenticatedSnapshot,
  live: SessionSnapshot<User>
): Promise<void> {
  rememberWorkspace(next.session.uid, undefined)
  if (live.phase !== 'error') return
  try {
    await workshopSessionClient.remint(undefined, {
      workspaceId: next.session.workspace.id,
      preserveCredentialOnTransientFailure: true
    })
  } catch {
    // The client remains authoritative in its published error state.
  }
}

async function settleFailedWorkspaceRestore(
  next: AuthenticatedSnapshot,
  permanent: boolean
): Promise<void> {
  const live = workshopSessionClient.getSnapshot()
  if (live.user?.uid !== next.session.uid) return
  if (!permanent) {
    publishTransientWorkspaceRestore(next, live)
    return
  }
  await recoverPersonalWorkspace(next, live)
}

async function restoreRememberedWorkspace(
  next: AuthenticatedSnapshot,
  remembered: string,
  attempt: OperationHandle
): Promise<void> {
  let result: Awaited<ReturnType<typeof workshopSessionClient.remint>>
  try {
    result = await workshopSessionClient.remint(undefined, {
      workspaceId: remembered,
      preserveCredentialOnTransientFailure: true
    })
  } catch {
    return
  }
  if (result?.status !== 'error' || !attempt.live()) return
  await settleFailedWorkspaceRestore(next, isPermanentSessionError(result.code))
}

function keepWorkspaceRemembered(): void {
  const current = snapshot.value
  if (current.phase !== 'authenticated') return
  rememberWorkspace(current.session.uid, current.session.workspace.id)
}

/**
 * The restore is one extra mint, and publishing the boot's personal
 * credential first would flash the wrong workspace for its duration. Hold
 * that first snapshot back - the page stays on its signing-in state - and
 * publish either the restored workspace or, if the restore is refused, the
 * held personal one so sign-in still completes.
 */
function holdsForRestore(next: SessionSnapshot<User>): boolean {
  if (next.phase !== 'authenticated') {
    if (next.phase === 'signed-out') restoredForUid = undefined
    return false
  }
  const { uid, workspace } = next.session
  if (restoredForUid === uid) return false
  restoredForUid = uid
  const remembered = rememberedWorkspace(uid)
  if (!remembered || remembered === workspace.id) return false
  void restoreRememberedWorkspace(next, remembered, operation.capture())
  return true
}

async function begin(attempt: OperationHandle): Promise<void> {
  await workshopIdentity.activate()
  if (!attempt.live()) return

  running = true
  stopSnapshot = workshopSessionClient.subscribe((next) => {
    if (next.phase !== 'pending') {
      identifyWorkshopUser(next.user ?? null)
    }
    if (holdsForRestore(next)) return
    snapshot.value = next
    keepWorkspaceRemembered()
  })
  // Auth-refresh telemetry starts and stops with this lifecycle; credits and
  // billing stay a separate consumer.
  stopTelemetry = subscribeAuthRefreshTelemetry()

  const onFocus = () => void ensureFreshHere()
  window.addEventListener('focus', onFocus)
  stopFocusListener = () => window.removeEventListener('focus', onFocus)
}

function start(): void {
  lifecycle.start(() => {
    const enabled = useWorkshopAuthFlag()
    watch(
      enabled,
      (on) => {
        if (on && running) return
        operation.abandon()
        const attempt = operation.capture()
        stopListeners()
        snapshot.value = PENDING
        if (!on) {
          restoredForUid = undefined
          workshopSessionClient.clearStoredCredential()
          return
        }
        void begin(attempt).catch((error: unknown) => {
          if (!attempt.live()) return
          console.error('Workshop auth initialization failed', error)
          // Nothing half-installed survives: abandon invalidates a restore
          // captured before begin threw, and the latch reopens so the next
          // caller retries instead of waiting out the timeout.
          operation.abandon()
          stopListeners()
          lifecycle.stop()
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
