import { promiseTimeout } from '@vueuse/core'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import {
  isSessionSuspended,
  resumeSession
} from '@/platform/auth/session/sessionExpiry'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { api } from '@/scripts/api'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useAuthStore } from '@/stores/authStore'

/**
 * Must exceed what it bounds, or the timeout fires on ordinary transient
 * failure rather than on a stall. `teamWorkspaceStore.initialize` makes four
 * attempts separated by 1s, 2s and 4s of backoff, so 7s elapses before the last
 * one even starts, and none of the four requests carries a deadline of its own.
 * No finite value truly covers that; this leaves ~23s spread across them.
 */
const WORKSPACE_SCOPE_TIMEOUT_MS = 30_000

let inFlightRestore: Promise<void> | null = null

/**
 * Re-initializes the team workspace store, which Firebase's sign-out reset.
 *
 * The only thing that normally initializes it is WorkspaceAuthGate's `onMounted`,
 * and recovering in place never remounts that gate. Without this a team user
 * resumes personal-scoped, with no workspace switcher and an account menu that
 * renders neither of its two branches.
 */
async function restoreWorkspaceScope(): Promise<void> {
  try {
    const { flags } = useFeatureFlags()
    if (!flags.teamWorkspacesEnabled) return

    const workspaceStore = useTeamWorkspaceStore()
    if (workspaceStore.initState !== 'uninitialized') return

    // Bounded only because the socket handshake waits on this. The gate does
    // not bound its copy at all, which is why a stalled workspace list hangs
    // the whole app behind its splash loader. Do not copy that.
    await Promise.race([
      workspaceStore.initialize(),
      promiseTimeout(WORKSPACE_SCOPE_TIMEOUT_MS).then(() => {
        throw new Error('Workspace scope restore timed out')
      })
    ])
  } catch (error) {
    // Same degradation the gate reaches on a throw: requests fall back to the
    // Firebase token. A timeout is worse than that, because a late success
    // still re-mints and leaves HTTP team-scoped against a personal socket.
    console.warn('Workspace scope could not be restored:', error)
  }
}

/**
 * Restores a cloud session and, only if the app can actually make requests
 * again, lifts a suspension.
 *
 * Both the auth-resolved hook and the banner's re-auth action reach this, and
 * on a recovery they both fire: the hook rides `whenever(resolvedUserInfo)`,
 * which is a plain watch over a computed that rebuilds its object, so the
 * sign-out's null and the re-sign-in's value are two transitions. The banner
 * still calls it directly because a re-sign-in that never cleared `currentUser`
 * raises no transition at all, and then nothing else would lift the suspension.
 * Hence the single-flight below rather than a second entry point.
 *
 * The session cookie is not the credential requests carry: `api.fetchApi`
 * sends `getAuthHeader()`, which under unified cloud auth is the workspace JWT
 * minted separately. Resuming on the cookie alone clears the banner over an app
 * whose every request still fails, with nothing left able to raise it again.
 */
export function restoreCloudSession(): Promise<void> {
  inFlightRestore ??= performRestore().finally(() => {
    inFlightRestore = null
  })
  return inFlightRestore
}

async function performRestore(): Promise<void> {
  const wasSuspended = isSessionSuspended()
  let mintReportedFailure = false

  try {
    await useSessionCookie().createSessionOrThrow()
    // `mintAtLogin` returns false without saying anything when the flag is off,
    // so reading the bare boolean as "it already told them" silences the only
    // failure message the whole non-unified path has.
    mintReportedFailure =
      useFeatureFlags().flags.unifiedCloudAuthEnabled &&
      !(await useWorkspaceAuthStore().mintAtLogin())

    if (!(await useAuthStore().getAuthHeader())) {
      throw new Error('Session restored without a usable request credential')
    }
    resumeSession()

    // Recovery only: an ordinary login mounts the gate, which owns workspace
    // init, and its connect is owned by api.init(), where resetting would
    // rotate the tab's client id.
    //
    // Scope before connect. The handshake token fixes the socket's scope, and
    // nothing re-handshakes on a workspace change: everywhere else the app
    // changes workspace by reloading. Only a dropped connection would correct
    // it, and a healthy socket never drops. Not awaited by the caller, so the
    // banner clears and HTTP resumes immediately either way.
    if (wasSuspended) {
      void restoreWorkspaceScope().finally(() => void api.reconnectSocket())
    }
  } catch (error) {
    console.warn('Cloud session could not be restored:', error)

    // Only the recovery path gets the message, and only when the mint did not
    // already name the same failure. This also runs on an ordinary login, where
    // "we couldn't restore your session" is simply untrue.
    if (wasSuspended && !mintReportedFailure) {
      useToastStore().add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('auth.sessionExpired.resumeFailed'),
        life: 5000
      })
    }
  }
}
