import { effectScope, getCurrentScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFakeAgentSocket } from './crdt/__fixtures__/agentSocket'
import {
  destroyAgentPageSession,
  useAgentPageSession
} from './agentPageSession'
import { createAgentEventSource } from './services/agent/agentEventSource'

vi.mock(import('@/scripts/api'))
vi.mock(import('./services/agent/agentAuth'))
vi.mock(import('./services/agent/agentEventSource'), { spy: true })
// The page session watches the signed-in identity, so it reaches the auth
// store and through it Firebase, which cannot initialize under vitest.
vi.mock(import('firebase/auth'))

let agentSocket: ReturnType<typeof createFakeAgentSocket>

beforeEach(() => {
  agentSocket = createFakeAgentSocket()
  vi.mocked(createAgentEventSource).mockReturnValue(agentSocket.socket)
  // Each test is a fresh page load.
  destroyAgentPageSession()
})

afterEach(() => {
  destroyAgentPageSession()
})

describe('useAgentPageSession', () => {
  it('returns the same transport to every caller in a page', () => {
    const first = useAgentPageSession()
    const second = useAgentPageSession()

    expect(second.events).toBe(first.events)
    expect(second.docTransport).toBe(first.docTransport)
  })

  // The regression this module exists for: the Agent panel used to construct
  // the transport in `setup` and destroy it in `onBeforeUnmount`, so closing
  // the panel closed the agent socket and the follower had to cold-seed on
  // reopen instead of resubscribing. A remount must re-tap a live socket. See
  // docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md
  it('survives a panel remount without minting a second event source', () => {
    const beforeUnmount = useAgentPageSession()

    // A panel unmount runs no teardown against the page session at all.
    const afterRemount = useAgentPageSession()

    expect(afterRemount.events).toBe(beforeUnmount.events)
    expect(createAgentEventSource).toHaveBeenCalledTimes(1)
  })

  it('keeps one doc-frame tap on the shared socket across a remount', () => {
    const tap = vi.spyOn(agentSocket.socket, 'subscribe')
    const { docTransport } = useAgentPageSession()

    docTransport.addEventListener('doc_update', () => {})
    // What a panel remount does: resolve again and attach another listener.
    useAgentPageSession().docTransport.addEventListener('doc_update', () => {})

    // The event source closes its socket when its last listener
    // unsubscribes, so one surviving tap is exactly what keeps a panel close
    // from disconnecting. One tap for the page, not one per consumer.
    expect(tap).toHaveBeenCalledTimes(1)
  })

  // The quiet half of the same ownership bug. A module-level singleton does
  // not change the active Vue scope, and the first resolution happens inside
  // `AgentPanelRoot.setup()`, so building the event source outside the page's
  // own scope would register `createAgentEventSource`'s `useTimeoutFn`
  // reconnect timer (`tryOnScopeDispose(stop)` in @vueuse/shared) on the
  // panel. Closing the panel during a pending backoff would then cancel the
  // retry while the transport and its doc tap survive — a connection that can
  // never come back, which is worse than the cold seed this change removes.
  it('builds the transport outside the resolving component scope', () => {
    let builtIn: ReturnType<typeof getCurrentScope>
    vi.mocked(createAgentEventSource).mockImplementation(() => {
      builtIn = getCurrentScope()
      return agentSocket.socket
    })

    // Stand in for the panel's setup scope, which is what resolves first.
    const panelScope = effectScope()
    panelScope.run(() => useAgentPageSession())

    expect(builtIn).toBeDefined()
    expect(builtIn).not.toBe(panelScope)

    // Closing the panel must not take the transport's timers with it.
    panelScope.stop()

    expect(builtIn!.active).toBe(true)
  })

  it('stops the transport scope only on an explicit page teardown', () => {
    let builtIn: ReturnType<typeof getCurrentScope>
    vi.mocked(createAgentEventSource).mockImplementation(() => {
      builtIn = getCurrentScope()
      return agentSocket.socket
    })
    useAgentPageSession()

    destroyAgentPageSession()

    expect(builtIn!.active).toBe(false)
  })

  it('mints a fresh transport after an explicit page teardown', () => {
    const first = useAgentPageSession()

    destroyAgentPageSession()
    const second = useAgentPageSession()

    // Identity cannot tell these apart — the stubbed factory hands back one
    // socket object every call — so assert the mint instead: a second event
    // source was constructed rather than the disposed one being handed out.
    expect(createAgentEventSource).toHaveBeenCalledTimes(2)
    expect(second.docTransport).not.toBe(first.docTransport)
  })
})
