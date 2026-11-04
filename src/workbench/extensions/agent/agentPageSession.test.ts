import { effectScope, getCurrentScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFakeAgentSocket } from './crdt/__fixtures__/agentSocket'
import type { SocketIdentity } from './agentPageSession'
import {
  destroyAgentPageSession,
  needsReauthentication,
  toSocketIdentity,
  useAgentPageSession
} from './agentPageSession'
import { createAgentEventSource } from './services/agent/agentEventSource'

vi.mock(import('@/scripts/api'))
vi.mock(import('./services/agent/agentAuth'))
vi.mock(import('./services/agent/agentEventSource'), { spy: true })

let agentSocket: ReturnType<typeof createFakeAgentSocket>

// Stands in for the stores the panel reads. The page session takes a getter
// rather than importing them, so a test supplies one directly.
let identity: SocketIdentity = [null, null, null]
const readIdentity = () => identity

beforeEach(() => {
  identity = [null, null, null]
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
    const first = useAgentPageSession(readIdentity)
    const second = useAgentPageSession(readIdentity)

    expect(second.events).toBe(first.events)
    expect(second.docTransport).toBe(first.docTransport)
  })

  // The regression this module exists for: the Agent panel used to construct
  // the transport in `setup` and destroy it in `onBeforeUnmount`, so closing
  // the panel closed the agent socket and the follower had to cold-seed on
  // reopen instead of resubscribing. A remount must re-tap a live socket. See
  // docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md
  it('survives a panel remount without minting a second event source', () => {
    const beforeUnmount = useAgentPageSession(readIdentity)

    // A panel unmount runs no teardown against the page session at all.
    const afterRemount = useAgentPageSession(readIdentity)

    expect(afterRemount.events).toBe(beforeUnmount.events)
    expect(createAgentEventSource).toHaveBeenCalledTimes(1)
  })

  it('keeps one doc-frame tap on the shared socket across a remount', () => {
    const tap = vi.spyOn(agentSocket.socket, 'subscribe')
    const { docTransport } = useAgentPageSession(readIdentity)

    docTransport.addEventListener('doc_update', () => {})
    // What a panel remount does: resolve again and attach another listener.
    useAgentPageSession(readIdentity).docTransport.addEventListener(
      'doc_update',
      () => {}
    )

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
    panelScope.run(() => useAgentPageSession(readIdentity))

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
    useAgentPageSession(readIdentity)

    destroyAgentPageSession()

    expect(builtIn!.active).toBe(false)
  })

  it('mints a fresh transport after an explicit page teardown', () => {
    const first = useAgentPageSession(readIdentity)

    destroyAgentPageSession()
    const second = useAgentPageSession(readIdentity)

    // Identity cannot tell these apart — the stubbed factory hands back one
    // socket object every call — so assert the mint instead: a second event
    // source was constructed rather than the disposed one being handed out.
    expect(createAgentEventSource).toHaveBeenCalledTimes(2)
    expect(second.docTransport).not.toBe(first.docTransport)
  })
})

describe('toSocketIdentity', () => {
  it('treats an API key user as the account when there is no Firebase account', () => {
    expect(toSocketIdentity(null, 'key-user', 'ws', 'host-ws')).toEqual([
      'key-user',
      'ws',
      'host-ws'
    ])
  })

  it('prefers the Firebase account over an API key user', () => {
    expect(toSocketIdentity('account', 'key-user', null, null)).toEqual([
      'account',
      null,
      null
    ])
  })

  it('collapses undefined to null so "not loaded yet" is not a change', () => {
    expect(
      toSocketIdentity(undefined, undefined, undefined, undefined)
    ).toEqual([null, null, null])
  })
})

describe('needsReauthentication', () => {
  it('is false when nothing moved', () => {
    expect(needsReauthentication(['a', 'ws', null], ['a', 'ws', null])).toBe(
      false
    )
  })

  it.for([
    { change: 'the account', from: ['a', 'ws', null], to: ['b', 'ws', null] },
    { change: 'a sign-out', from: ['a', 'ws', null], to: [null, 'ws', null] },
    {
      change: 'the workspace',
      from: ['a', 'ws-a', null],
      to: ['a', 'ws-b', null]
    },
    {
      change: 'the host workspace',
      from: ['a', null, 'host-a'],
      to: ['a', null, 'host-b']
    }
  ])('is true when $change changes', ({ from, to }) => {
    expect(needsReauthentication(to as never, from as never)).toBe(true)
  })

  // The one intentional exception, and the reason it exists: during an
  // ordinary workspace refresh the active workspace reads as null for a beat
  // while the account is unchanged. Reconnecting there would bounce the socket
  // on every refresh.
  it('ignores a workspace blanking for an unchanged signed-in account', () => {
    expect(needsReauthentication(['a', null, null], ['a', 'ws', null])).toBe(
      false
    )
  })

  it('does not extend that exception to a signed-out account', () => {
    expect(needsReauthentication([null, null, null], ['a', 'ws', null])).toBe(
      true
    )
  })

  it('does not extend that exception while Desktop pins a workspace', () => {
    expect(
      needsReauthentication(['a', null, 'host-a'], ['a', 'ws', 'host-a'])
    ).toBe(true)
  })
})
