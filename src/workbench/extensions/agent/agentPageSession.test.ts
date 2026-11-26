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

let identity: SocketIdentity = [null, null, null]
const readIdentity = () => identity

beforeEach(() => {
  identity = [null, null, null]
  agentSocket = createFakeAgentSocket()
  vi.mocked(createAgentEventSource).mockReturnValue(agentSocket.socket)
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

  it('survives a panel remount without minting a second event source', () => {
    const beforeUnmount = useAgentPageSession(readIdentity)

    const afterRemount = useAgentPageSession(readIdentity)

    expect(afterRemount.events).toBe(beforeUnmount.events)
    expect(createAgentEventSource).toHaveBeenCalledTimes(1)
  })

  it('keeps one doc-frame tap on the shared socket across a remount', () => {
    const tap = vi.spyOn(agentSocket.socket, 'subscribe')
    const { docTransport } = useAgentPageSession(readIdentity)

    docTransport.addEventListener('doc_update', () => {})
    useAgentPageSession(readIdentity).docTransport.addEventListener(
      'doc_update',
      () => {}
    )

    expect(tap).toHaveBeenCalledTimes(1)
  })

  it('builds the transport outside the resolving component scope', () => {
    let builtIn: ReturnType<typeof getCurrentScope>
    vi.mocked(createAgentEventSource).mockImplementation(() => {
      builtIn = getCurrentScope()
      return agentSocket.socket
    })

    const panelScope = effectScope()
    panelScope.run(() => useAgentPageSession(readIdentity))

    expect(builtIn).toBeDefined()
    expect(builtIn).not.toBe(panelScope)

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

  it.for<{ change: string; from: SocketIdentity; to: SocketIdentity }>([
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
    expect(needsReauthentication(to, from)).toBe(true)
  })

  it('ignores a workspace blanking during a workspace refresh, for an unchanged signed-in account', () => {
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
