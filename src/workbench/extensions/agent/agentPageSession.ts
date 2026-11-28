import { computed, effectScope, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import { reportError } from '@comfyorg/telemetry/reportError'

import { api } from '@/scripts/api'
import { assert } from '@/base/assert'

import { destroyAgentPageOpMinters } from './agentPageOpMinter'
import type { AgentDocFrameTransport } from './crdt/agentDocFrameTransport'
import { createAgentDocFrameTransport } from './crdt/agentDocFrameTransport'
import { destroyAgentFollowerSessions } from './crdt/useAgentCrdtFollower'
import { agentSocketAuthParams } from './services/agent/agentAuth'
import type { AgentEventSocket } from './services/agent/agentEventSource'
import { createAgentEventSource } from './services/agent/agentEventSource'
import { captureOutgoingCredentialForHandoff } from './services/agent/agentOwnerHandoff'
import type {
  AgentIdentityDeps,
  ResolvedAgentIdentity
} from './services/agent/agentIdentity'
import { resolveAgentIdentity } from './services/agent/agentIdentity'

/** Agent transport resources whose lifetime is the page, not the Agent panel. */
export interface AgentPageSession {
  /** The shared agent websocket. Reference-counts its own connection. */
  readonly events: AgentEventSocket
  /** The doc-frame tap over {@link events}, for the CRDT follower seam. */
  readonly docTransport: AgentDocFrameTransport
  /** The current account accepted by the Agent API, or null while unresolved. */
  readonly userId: Readonly<Ref<string | null>>
  /** Observe the signed-in identity changing, after the socket reconnects. */
  onIdentityChange(listener: () => void): () => void
  /** Resolve the agent actor for the page lifetime. Only the first deps are installed. */
  retainIdentity(deps: Omit<AgentIdentityDeps, 'onSocketOpen'>): void
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
  const agentIdentity = shallowRef<ResolvedAgentIdentity | null>(null)

  const pageScope = effectScope(true)
  const built = pageScope.run(() => {
    const events = createAgentEventSource({
      endpoint: api.apiURL('/agent/events'),
      getAuthParams: agentSocketAuthParams,
      reportFailure: (error, failure) =>
        reportError(error, {
          surface: 'agent',
          errorType: 'failure_opening_agent_socket',
          level: 'warning',
          tags: { failure }
        })
    })
    const docTransport = createAgentDocFrameTransport(events)
    const userId = computed(() => {
      const current = agentIdentity.value?.state.value
      return current?.status === 'resolved' ? current.userId : null
    })

    const identity = computed<SocketIdentity>(() => readIdentity())
    let identityResetPending = false
    watch(
      identity,
      (next, previous) => {
        if (identityResetPending || !needsReauthentication(next, previous))
          return
        identityResetPending = true
        captureOutgoingCredentialForHandoff()
        agentIdentity.value?.reset()
      },
      { flush: 'sync' }
    )
    watch(identity, (next, previous) => {
      identityResetPending = false
      if (!needsReauthentication(next, previous)) return
      events.reconnect()
      listeners.forEach((listener) => listener())
    })
    return { events, docTransport, userId }
  })
  assert(
    built !== undefined,
    'the agent page session scope was already stopped before it built the transport — see docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md Stage 1a'
  )
  const { events, docTransport, userId } = built

  return {
    events,
    docTransport,
    userId,
    onIdentityChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    retainIdentity(deps) {
      if (agentIdentity.value !== null) return
      agentIdentity.value = resolveAgentIdentity({
        ...deps,
        onSocketOpen: (listener) => docTransport.onSocketOpen(listener)
      })
    },
    stop() {
      pageScope.stop()
      listeners.clear()
      agentIdentity.value?.stop()
      agentIdentity.value = null
      docTransport.destroy()
    }
  }
}

/** Resolve the page's agent resources, installing only the first call's sources. */
export function useAgentPageSession(
  readIdentity: SocketIdentitySource
): AgentPageSession {
  session ??= create(readIdentity)
  return session
}

/**
 * Tear down the page's agent transport and the follower sessions over it.
 * Never call this on panel close.
 */
export function destroyAgentPageSession(): void {
  destroyAgentPageOpMinters()
  destroyAgentFollowerSessions()
  session?.stop()
  session = null
}
