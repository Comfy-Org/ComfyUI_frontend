import { computed, effectScope, watch } from 'vue'

import { api } from '@/scripts/api'
import { assert } from '@/base/assert'

import type { AgentDocFrameTransport } from './crdt/agentDocFrameTransport'
import { createAgentDocFrameTransport } from './crdt/agentDocFrameTransport'
import { agentSocketAuthParams } from './services/agent/agentAuth'
import type { AgentEventSocket } from './services/agent/agentEventSource'
import { createAgentEventSource } from './services/agent/agentEventSource'

/**
 * The agent transport resources whose lifetime is the page, not the Agent panel.
 *
 * Stage 1a of
 * {@link ../../../../docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md CRDT-FOLLOWER-0052}.
 * `AgentPanelRoot.vue` used to construct both of these in its own `setup` and
 * destroy the doc-frame transport in `onBeforeUnmount`, which made closing the
 * panel close the agent socket: the event source reference-counts its socket by
 * listener count and disconnects at zero (`agentEventSource.ts`), and panel
 * teardown dropped the doc-frame tap and the session stream together.
 *
 * A follower session that outlives the panel (Decision 1) is useless while the
 * panel still owns the transport — it could neither receive an update nor
 * resubscribe — so ownership moves here first. The panel now consumes these.
 *
 * **The socket's authentication lifetime moves with the socket.** That is not a
 * detail: a connection that outlives the panel outlives the panel's watchers
 * too, so leaving the account/workspace watcher behind in the component would
 * let a sign-out or a workspace switch made while the panel is closed leave a
 * live socket authenticated for the previous context, and the panel would
 * resolve that same socket on reopen. The watcher therefore lives here, beside
 * the connection whose credentials it governs.
 */
export interface AgentPageSession {
  /** The shared agent websocket. Reference-counts its own connection. */
  readonly events: AgentEventSocket
  /** The doc-frame tap over {@link events}, for the CRDT follower seam. */
  readonly docTransport: AgentDocFrameTransport
  /**
   * Observe the signed-in identity changing, after the socket has been told to
   * reconnect under the new credentials.
   *
   * @returns an unsubscribe function
   */
  onIdentityChange(listener: () => void): () => void
}

export type SocketIdentity = readonly [
  account: string | null,
  workspace: string | null,
  hostWorkspace: string | null
]

/**
 * Reads the signed-in identity the socket authenticates as.
 *
 * Passed in rather than imported, deliberately. This module is reached from
 * `AgentPanelRoot.vue`'s import graph, and pulling the auth, API-key and
 * workspace stores in here put them on a path they were not on before, which
 * hung an unrelated suite's app bootstrap (`AssetsSidebarListView`) at
 * `appBridge.loading`. The caller already imports those stores, so handing over
 * a getter keeps the import graph exactly as it was while the *watcher* still
 * lives — and still survives — in the page's own scope, which is the property
 * that matters.
 */
export type SocketIdentitySource = () => SocketIdentity

/**
 * Whether an identity tuple change should re-authenticate the socket.
 *
 * Moved verbatim from `AgentPanelRoot.vue` so the rule did not change while its
 * owner did. The second clause ignores the transient window in which a
 * workspace reads as null for an unchanged signed-in account, which would
 * otherwise reconnect the socket on an ordinary workspace refresh.
 */
function needsReauthentication(
  [account, workspace, hostWorkspace]: SocketIdentity,
  [wasAccount, wasWorkspace, wasHostWorkspace]: SocketIdentity
): boolean {
  if (
    account === wasAccount &&
    workspace === wasWorkspace &&
    hostWorkspace === wasHostWorkspace
  )
    return false
  return !(
    workspace === null &&
    account === wasAccount &&
    account !== null &&
    hostWorkspace === null
  )
}

interface PageSessionInternals extends AgentPageSession {
  readonly stop: () => void
}

let session: PageSessionInternals | null = null

function create(readIdentity: SocketIdentitySource): PageSessionInternals {
  // One transport per page, so a follower session cannot end up holding a
  // different socket than the one the agent session streams over, and a panel
  // remount cannot leave an orphaned connection behind.
  assert(
    session === null,
    'minted a second agent event source while one already exists for this page — the page session owns exactly one event source and one doc-frame transport for the page lifetime, see docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md Decision 2'
  )
  const listeners = new Set<() => void>()

  // Detached, and **everything** is built inside it. This scope belongs to the
  // page, so it must not be adopted by whichever component happens to resolve
  // the session first — that is the panel, and being torn down with the panel
  // is the bug.
  //
  // Constructing the event source outside this scope would be a quiet version
  // of the same defect: a module-level singleton does not change the active Vue
  // scope, and the first `useAgentPageSession()` runs synchronously inside
  // `AgentPanelRoot.setup()`, so `createAgentEventSource`'s `useTimeoutFn`
  // reconnect timer would register `tryOnScopeDispose` on the panel. Closing
  // the panel during a pending backoff would then cancel the retry while the
  // transport and its doc tap survive — a connection that can never come back,
  // which is worse than the cold seed this change removes.
  const scope = effectScope(true)
  const built = scope.run(() => {
    const events = createAgentEventSource({
      endpoint: api.apiURL('/agent/events'),
      getAuthParams: agentSocketAuthParams
    })
    const docTransport = createAgentDocFrameTransport(events)

    const identity = computed<SocketIdentity>(() => readIdentity())
    watch(identity, (next, previous) => {
      if (!needsReauthentication(next, previous)) return
      events.reconnect()
      listeners.forEach((listener) => listener())
    })
    return { events, docTransport }
  })
  assert(
    built !== undefined,
    'the agent page session scope was already stopped before it built the transport — see docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md Stage 1a'
  )
  const { events, docTransport } = built

  return {
    events,
    docTransport,
    onIdentityChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    stop() {
      scope.stop()
      listeners.clear()
      docTransport.destroy()
    }
  }
}

/**
 * Resolve the page's agent transport, creating it on first use.
 *
 * Idempotent by construction: every caller in a page gets the same event source
 * and the same doc-frame transport, so a panel remount re-taps a live socket
 * instead of opening a second one.
 *
 * @param readIdentity reads the signed-in identity the socket authenticates as.
 * Only the first resolution in a page installs it, because it is watched for
 * the page's lifetime and not the caller's; later callers get the existing
 * session and their argument is ignored.
 */
export function useAgentPageSession(
  readIdentity: SocketIdentitySource
): AgentPageSession {
  session ??= create(readIdentity)
  return session
}

/**
 * Tear down the page's agent transport.
 *
 * **Not a panel teardown hook.** Closing the Agent panel must not call this:
 * that is the behaviour CRDT-FOLLOWER-0052 Stage 1a removes. It exists so a
 * test can start from a clean page, and for a genuine page-level teardown.
 */
export function destroyAgentPageSession(): void {
  session?.stop()
  session = null
}
