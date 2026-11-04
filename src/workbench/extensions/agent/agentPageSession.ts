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
 */
export interface AgentPageSession {
  /** The shared agent websocket. Reference-counts its own connection. */
  readonly events: AgentEventSocket
  /** The doc-frame tap over {@link events}, for the CRDT follower seam. */
  readonly docTransport: AgentDocFrameTransport
}

let session: AgentPageSession | null = null

function create(): AgentPageSession {
  // One transport per page, so a follower session cannot end up holding a
  // different socket than the one the agent session streams over, and a panel
  // remount cannot leave an orphaned connection behind.
  assert(
    session === null,
    'minted a second agent event source while one already exists for this page — the page session owns exactly one event source and one doc-frame transport for the page lifetime, see docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md Decision 2'
  )
  const events = createAgentEventSource({
    endpoint: api.apiURL('/agent/events'),
    getAuthParams: agentSocketAuthParams
  })
  return { events, docTransport: createAgentDocFrameTransport(events) }
}

/**
 * Resolve the page's agent transport, creating it on first use.
 *
 * Idempotent by construction: every caller in a page gets the same event source
 * and the same doc-frame transport, so a panel remount re-taps a live socket
 * instead of opening a second one.
 */
export function useAgentPageSession(): AgentPageSession {
  session ??= create()
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
  session?.docTransport.destroy()
  session = null
}
