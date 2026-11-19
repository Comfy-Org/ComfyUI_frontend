import { computed, effectScope, watch } from 'vue'

import { api } from '@/scripts/api'
import { assert } from '@/base/assert'

import type { AgentDocFrameTransport } from './crdt/agentDocFrameTransport'
import { createAgentDocFrameTransport } from './crdt/agentDocFrameTransport'
import { agentSocketAuthParams } from '@/platform/auth/agentAuth'
import type { AgentEventSocket } from './services/agent/agentEventSource'
import { createAgentEventSource } from './services/agent/agentEventSource'

/** Agent transport resources whose lifetime is the page, not the Agent panel. */
export interface AgentPageSession {
  /** The shared agent websocket. Reference-counts its own connection. */
  readonly events: AgentEventSocket
  /** The doc-frame tap over {@link events}, for the CRDT follower seam. */
  readonly docTransport: AgentDocFrameTransport
  /** Observe the signed-in identity changing, after the socket reconnects. */
  onIdentityChange(listener: () => void): () => void
}

export type SocketIdentity = readonly [
  account: string | null,
  workspace: string | null,
  hostWorkspace: string | null
]

/** Reads the signed-in identity the socket authenticates as. */
export type SocketIdentitySource = () => SocketIdentity

/** Normalise the identity the socket authenticates as, collapsing absent to null. */
export function toSocketIdentity(
  accountId: string | null | undefined,
  apiKeyUserId: string | null | undefined,
  workspaceId: string | null | undefined,
  hostWorkspaceId: string | null | undefined
): SocketIdentity {
  return [
    accountId ?? apiKeyUserId ?? null,
    workspaceId ?? null,
    hostWorkspaceId ?? null
  ]
}

/** Whether an identity tuple change should re-authenticate the socket. */
export function needsReauthentication(
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
  assert(
    session === null,
    'minted a second agent event source while one already exists for this page — the page session owns exactly one event source and one doc-frame transport for the page lifetime, see docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md Decision 2'
  )
  const listeners = new Set<() => void>()

  const pageScope = effectScope(true)
  const built = pageScope.run(() => {
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
      pageScope.stop()
      listeners.clear()
      docTransport.destroy()
    }
  }
}

/** Resolve the page's agent transport, creating it on first use. Only the first call's `readIdentity` is installed. */
export function useAgentPageSession(
  readIdentity: SocketIdentitySource
): AgentPageSession {
  session ??= create(readIdentity)
  return session
}

/** Tear down the page's agent transport. Never call this on panel close. */
export function destroyAgentPageSession(): void {
  session?.stop()
  session = null
}
