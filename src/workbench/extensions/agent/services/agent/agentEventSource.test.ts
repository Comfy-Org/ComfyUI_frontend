import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAgentEventSource } from './agentEventSource'

class FakeSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static instances: FakeSocket[] = []

  readyState = FakeSocket.CONNECTING
  send = vi.fn()

  constructor(readonly url: string) {
    super()
    FakeSocket.instances.push(this)
  }

  open(): void {
    this.readyState = FakeSocket.OPEN
    this.dispatchEvent(new Event('open'))
  }

  receive(frame: unknown): void {
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(frame) })
    )
  }

  receiveRaw(data: string): void {
    this.dispatchEvent(new MessageEvent('message', { data }))
  }

  error(): void {
    this.dispatchEvent(new Event('error'))
  }

  close(): void {
    if (this.readyState === FakeSocket.CLOSED) return
    this.readyState = FakeSocket.CLOSED
    this.dispatchEvent(new Event('close'))
  }
}

async function connected(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

function sockets(): FakeSocket[] {
  return FakeSocket.instances
}

function lastSocket(): FakeSocket {
  const socket = FakeSocket.instances.at(-1)
  if (!socket) throw new Error('no socket was opened')
  return socket
}

function createSource({
  getToken = async () => undefined,
  ...options
}: {
  endpoint?: string
  getToken?: () => Promise<string | undefined>
  random?: () => number
  maxReconnectDelayMs?: number
} = {}) {
  return createAgentEventSource({
    endpoint: '/api/agent/events',
    getAuthParams: async () => {
      const token = await getToken()
      return new URLSearchParams(token === undefined ? {} : { token })
    },
    random: () => 1,
    ...options
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  FakeSocket.instances = []
  vi.stubGlobal('WebSocket', FakeSocket)
})

describe('createAgentEventSource', () => {
  it.for([
    ['http://agent.test/api/agent/events', 'ws:'],
    ['https://agent.test/api/agent/events', 'wss:']
  ])(
    'transforms %s into a %s socket endpoint',
    async ([endpoint, protocol]) => {
      const source = createSource({ endpoint })

      source.subscribe(vi.fn())
      await connected()

      const socketUrl = new URL(lastSocket().url)
      expect(socketUrl.protocol).toBe(protocol)
      expect(socketUrl.host).toBe('agent.test')
      expect(socketUrl.pathname).toBe('/api/agent/events')
    }
  )

  it('delivers JSON frames', async () => {
    const source = createSource()
    const seen = vi.fn()

    source.subscribe(seen)
    await connected()
    lastSocket().open()
    lastSocket().receive({ type: 'agent_message_delta', data: { delta: 'hi' } })

    expect(seen).toHaveBeenCalledWith({
      type: 'agent_message_delta',
      data: { delta: 'hi' }
    })
  })

  it('reports the current state to a status listener that joins an open socket', async () => {
    const source = createSource()
    const status = vi.fn()

    source.subscribe(vi.fn())
    await connected()
    lastSocket().open()
    source.onStatus(status)

    expect(status.mock.calls).toEqual([[true]])
  })

  it('forwards an empty text frame instead of dropping it', async () => {
    const source = createSource()
    const seen = vi.fn()

    source.subscribe(seen)
    await connected()
    lastSocket().open()
    lastSocket().receiveRaw('')

    expect(seen).toHaveBeenCalledWith('')
  })

  it('reconnects exactly once when the upgrade fails before open', async () => {
    const source = createSource()
    const status = vi.fn()

    source.subscribe(vi.fn())
    await connected()
    source.onStatus(status)
    lastSocket().error()
    await vi.advanceTimersByTimeAsync(999)

    expect(sockets()[0].readyState).toBe(FakeSocket.CLOSED)
    expect(status.mock.calls).toEqual([[false], [false]])
    expect(sockets()).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(sockets()).toHaveLength(2)

    await vi.advanceTimersByTimeAsync(5000)
    expect(sockets()).toHaveLength(2)
  })

  it('reports live again once the replacement socket opens', async () => {
    const source = createSource()
    const status = vi.fn()

    source.subscribe(vi.fn())
    await connected()
    source.onStatus(status)
    sockets()[0].open()
    sockets()[0].close()
    await vi.advanceTimersByTimeAsync(1000)
    sockets()[1].open()

    expect(status.mock.calls.map(([live]) => live)).toEqual([
      false,
      true,
      false,
      true
    ])
  })

  it('drops frames from a superseded socket after resubscribing', async () => {
    const source = createSource()
    const first = vi.fn()
    const second = vi.fn()

    const unsubscribe = source.subscribe(first)
    await connected()
    sockets()[0].open()
    unsubscribe()
    source.subscribe(second)
    await connected()
    sockets()[1].open()
    sockets()[0].receive({
      type: 'agent_message_delta',
      data: { delta: 'old' }
    })
    sockets()[1].receive({
      type: 'agent_message_delta',
      data: { delta: 'new' }
    })

    expect(sockets()).toHaveLength(2)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledWith({
      type: 'agent_message_delta',
      data: { delta: 'new' }
    })
  })

  it('stops the socket and pending reconnect on unsubscribe', async () => {
    const source = createSource()

    const unsubscribe = source.subscribe(vi.fn())
    await connected()
    sockets()[0].open()
    sockets()[0].close()
    unsubscribe()
    await vi.advanceTimersByTimeAsync(1000)

    expect(sockets()).toHaveLength(1)
  })

  it('reports the stream down when the last subscriber leaves', async () => {
    const source = createSource()
    const status = vi.fn()
    source.onStatus(status)

    const unsubscribe = source.subscribe(vi.fn())
    await connected()
    sockets()[0].open()
    unsubscribe()

    expect(status.mock.calls).toEqual([[false], [true], [false]])
    expect(sockets()[0].readyState).toBe(FakeSocket.CLOSED)
  })
})

describe('createAgentEventSource reconnect backoff', () => {
  it('doubles the delay per refused connect and resets once a socket delivers a frame', async () => {
    const source = createSource()

    source.subscribe(vi.fn())
    await connected()
    sockets()[0].error()
    await vi.advanceTimersByTimeAsync(1000)
    sockets()[1].error()
    await vi.advanceTimersByTimeAsync(1999)
    expect(sockets()).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(sockets()).toHaveLength(3)

    sockets()[2].open()
    sockets()[2].receive({ type: 'agent_message_delta', data: {} })
    sockets()[2].close()
    await vi.advanceTimersByTimeAsync(1000)
    expect(sockets()).toHaveLength(4)
  })

  it('keeps backing off when the server accepts the upgrade and then closes', async () => {
    const source = createSource()

    source.subscribe(vi.fn())
    await connected()
    for (const wait of [1000, 2000, 4000]) {
      lastSocket().open()
      lastSocket().close()
      const opened = sockets().length
      await vi.advanceTimersByTimeAsync(wait - 1)
      expect(sockets()).toHaveLength(opened)
      await vi.advanceTimersByTimeAsync(1)
      expect(sockets()).toHaveLength(opened + 1)
    }
  })

  it('reconnects promptly after a socket that stayed open closes without traffic', async () => {
    const source = createSource()
    source.subscribe(vi.fn())
    await connected()
    sockets()[0].error()
    await vi.advanceTimersByTimeAsync(1_000)
    sockets()[1].error()
    await vi.advanceTimersByTimeAsync(2_000)

    sockets()[2].open()
    await vi.advanceTimersByTimeAsync(30_000)
    sockets()[2].close()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(sockets()).toHaveLength(4)
  })

  it('caps the delay and spreads it with jitter', async () => {
    const source = createSource({ maxReconnectDelayMs: 4000, random: () => 0 })

    source.subscribe(vi.fn())
    await connected()
    for (const wait of [500, 1000, 2000, 2000]) {
      lastSocket().error()
      await vi.advanceTimersByTimeAsync(wait)
    }

    expect(sockets()).toHaveLength(5)
  })
})

describe('createAgentEventSource reconnect', () => {
  it('drops the open socket and connects again with a freshly read token', async () => {
    const tokens = ['account-a', 'account-b']
    const source = createSource({ getToken: async () => tokens.shift() })
    source.subscribe(vi.fn())
    await connected()
    sockets()[0].open()

    source.reconnect()
    await connected()

    expect(sockets()[0].readyState).toBe(FakeSocket.CLOSED)
    expect(sockets()).toHaveLength(2)
    expect(new URL(sockets()[1].url).searchParams.get('token')).toBe(
      'account-b'
    )
  })

  it('opens the socket with the newer token when a reconnect lands while the first token is read', async () => {
    const pending: ((token: string) => void)[] = []
    const source = createSource({
      getToken: () => new Promise((resolve) => pending.push(resolve))
    })

    source.subscribe(vi.fn())
    source.reconnect()
    pending[0]('account-a')
    await connected()
    pending[1]('account-b')
    await connected()

    expect(
      sockets().map((socket) => new URL(socket.url).searchParams.get('token'))
    ).toEqual(['account-b'])
  })

  it('opens nothing when no one is listening', async () => {
    const source = createSource()

    source.reconnect()
    await connected()

    expect(sockets()).toHaveLength(0)
  })
})

describe('createAgentEventSource token', () => {
  it('presents the caller credential as ?token=, read afresh on every connect', async () => {
    const tokens = ['first', 'second']
    const source = createSource({ getToken: async () => tokens.shift() })

    source.subscribe(vi.fn())
    await connected()
    sockets()[0].open()
    sockets()[0].close()
    await vi.advanceTimersByTimeAsync(1000)

    expect(new URL(sockets()[0].url).searchParams.get('token')).toBe('first')
    expect(new URL(sockets()[1].url).searchParams.get('token')).toBe('second')
  })

  it.for([
    { label: 'there is no credential', getToken: async () => undefined },
    {
      label: 'the read fails',
      getToken: async (): Promise<string | undefined> => {
        throw new Error('token refresh failed')
      }
    }
  ])('connects without a token when $label', async ({ getToken }) => {
    const source = createSource({ getToken })

    source.subscribe(vi.fn())
    await connected()

    expect(new URL(lastSocket().url).searchParams.has('token')).toBe(false)
  })

  it('carries every auth param onto the socket URL', async () => {
    const source = createAgentEventSource({
      endpoint: '/api/agent/events',
      getAuthParams: async () => new URLSearchParams({ workspace_id: 'ws-1' })
    })

    source.subscribe(vi.fn())
    await connected()

    const params = new URL(lastSocket().url).searchParams
    expect(params.get('workspace_id')).toBe('ws-1')
    expect(params.has('token')).toBe(false)
  })

  it('opens nothing when the last listener leaves while the token is read', async () => {
    const source = createSource({ getToken: async () => 't' })

    source.subscribe(vi.fn())()
    await connected()

    expect(sockets()).toHaveLength(0)
  })

  it('opens exactly one socket when a listener returns while the token is read', async () => {
    const source = createSource({ getToken: async () => 't' })

    source.subscribe(vi.fn())()
    source.subscribe(vi.fn())
    await connected()

    expect(sockets()).toHaveLength(1)
  })
})

describe('createAgentEventSource send', () => {
  it('reports false before the socket is open and writes nothing', async () => {
    const source = createSource()
    source.subscribe(vi.fn())
    await connected()

    expect(source.send('{"type":"doc_subscribe"}')).toBe(false)
    expect(lastSocket().send).not.toHaveBeenCalled()
  })

  it('writes the frame verbatim on the open socket and reports true', async () => {
    const source = createSource()
    source.subscribe(vi.fn())
    await connected()
    lastSocket().open()

    expect(source.send('{"type":"doc_subscribe"}')).toBe(true)
    expect(lastSocket().send).toHaveBeenCalledWith('{"type":"doc_subscribe"}')
  })
})
