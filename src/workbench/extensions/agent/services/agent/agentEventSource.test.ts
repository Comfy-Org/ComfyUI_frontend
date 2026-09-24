import { describe, expect, it, vi } from 'vitest'

import { createAgentEventSource } from './agentEventSource'

class FakeSocket extends EventTarget {
  readyState: number = WebSocket.CONNECTING
  readonly url: string

  constructor(url: string) {
    super()
    this.url = url
  }

  open(): void {
    this.readyState = WebSocket.OPEN
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
    if (this.readyState === WebSocket.CLOSED) return
    this.readyState = WebSocket.CLOSED
    this.dispatchEvent(new Event('close'))
  }
}

// Every connect reads the token first, so the socket opens a few microtasks
// after subscribe (or after the reconnect timer fires).
async function connected(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

function sourceHarness(
  endpoint = '/api/agent/events',
  getToken?: () => Promise<string | undefined>
) {
  const sockets: FakeSocket[] = []
  const source = createAgentEventSource({
    endpoint,
    getToken,
    // No jitter: every reconnect waits its full delay.
    random: () => 1,
    createSocket(url) {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      return socket as unknown as WebSocket
    }
  })
  return { source, sockets }
}

describe('createAgentEventSource', () => {
  it.for([
    ['http://agent.test/api/agent/events', 'ws:'],
    ['https://agent.test/api/agent/events', 'wss:']
  ])(
    'transforms %s into a %s socket endpoint',
    async ([endpoint, protocol]) => {
      const { source, sockets } = sourceHarness(endpoint)

      source.subscribe(vi.fn())

      await connected()

      const socketUrl = new URL(sockets[0].url)
      expect(socketUrl.protocol).toBe(protocol)
      expect(socketUrl.host).toBe('agent.test')
      expect(socketUrl.pathname).toBe('/api/agent/events')
    }
  )

  it('delivers JSON frames from the same-origin agent proxy', async () => {
    const { source, sockets } = sourceHarness()
    const seen = vi.fn()
    const status = vi.fn()

    source.subscribe(seen)

    await connected()
    source.onStatus?.(status)
    sockets[0].open()
    sockets[0].receive({ type: 'agent_message_delta', data: { delta: 'hi' } })

    expect(status).toHaveBeenCalledWith(true)
    expect(seen).toHaveBeenCalledWith({
      type: 'agent_message_delta',
      data: { delta: 'hi' }
    })
  })

  it('forwards an empty text frame instead of dropping it', async () => {
    const { source, sockets } = sourceHarness()
    const seen = vi.fn()

    source.subscribe(seen)

    await connected()
    sockets[0].open()
    sockets[0].receiveRaw('')

    expect(seen).toHaveBeenCalledWith('')
  })

  it('reconnects after a backend reload', async () => {
    vi.useFakeTimers()
    const { source, sockets } = sourceHarness()
    const status = vi.fn()

    source.subscribe(vi.fn())

    await connected()
    source.onStatus?.(status)
    sockets[0].open()
    sockets[0].close()
    await vi.advanceTimersByTimeAsync(1000)

    expect(status).toHaveBeenLastCalledWith(false)
    expect(sockets).toHaveLength(2)
  })

  it('reconnects exactly once when the upgrade fails before open', async () => {
    vi.useFakeTimers()
    const { source, sockets } = sourceHarness()
    const status = vi.fn()

    source.subscribe(vi.fn())

    await connected()
    source.onStatus?.(status)
    sockets[0].error()
    await vi.advanceTimersByTimeAsync(999)

    expect(sockets[0].readyState).toBe(WebSocket.CLOSED)
    expect(status).toHaveBeenCalledTimes(1)
    expect(status).toHaveBeenLastCalledWith(false)
    expect(sockets).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(sockets).toHaveLength(2)

    await vi.advanceTimersByTimeAsync(5000)
    expect(sockets).toHaveLength(2)
  })

  it('reports live again once the replacement socket opens', async () => {
    vi.useFakeTimers()
    const { source, sockets } = sourceHarness()
    const status = vi.fn()

    source.subscribe(vi.fn())

    await connected()
    source.onStatus?.(status)
    sockets[0].open()
    sockets[0].close()
    await vi.advanceTimersByTimeAsync(1000)
    sockets[1].open()

    expect(status.mock.calls.map(([live]) => live)).toEqual([true, false, true])
  })

  it('drops frames from a superseded socket after resubscribing', async () => {
    vi.useFakeTimers()
    const { source, sockets } = sourceHarness()
    const first = vi.fn()
    const second = vi.fn()

    const unsubscribe = source.subscribe(first)

    await connected()
    sockets[0].open()
    unsubscribe()
    source.subscribe(second)
    await connected()
    sockets[1].open()
    sockets[0].receive({ type: 'agent_message_delta', data: { delta: 'old' } })
    sockets[1].receive({ type: 'agent_message_delta', data: { delta: 'new' } })

    expect(sockets).toHaveLength(2)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledWith({
      type: 'agent_message_delta',
      data: { delta: 'new' }
    })
  })

  it('stops the socket and pending reconnect on unsubscribe', async () => {
    vi.useFakeTimers()
    const { source, sockets } = sourceHarness()

    const unsubscribe = source.subscribe(vi.fn())

    await connected()
    sockets[0].open()
    sockets[0].close()
    unsubscribe()
    await vi.advanceTimersByTimeAsync(1000)

    expect(sockets).toHaveLength(1)
  })

  it('reports the stream down when the last subscriber leaves', async () => {
    const { source, sockets } = sourceHarness()
    const status = vi.fn()
    source.onStatus?.(status)

    const unsubscribe = source.subscribe(vi.fn())

    await connected()
    sockets[0].open()
    unsubscribe()

    expect(status.mock.calls).toEqual([[true], [false]])
    expect(sockets[0].readyState).toBe(WebSocket.CLOSED)
  })
})

describe('createAgentEventSource reconnect backoff', () => {
  it('doubles the delay per refused connect and resets once a socket opens', async () => {
    vi.useFakeTimers()
    const { source, sockets } = sourceHarness()

    source.subscribe(vi.fn())
    await connected()
    sockets[0].error()
    await vi.advanceTimersByTimeAsync(1000)
    await connected()
    sockets[1].error()
    await vi.advanceTimersByTimeAsync(1999)
    expect(sockets).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    await connected()
    expect(sockets).toHaveLength(3)

    sockets[2].open()
    sockets[2].close()
    await vi.advanceTimersByTimeAsync(1000)
    await connected()
    expect(sockets).toHaveLength(4)
  })

  it('caps the delay and spreads it with jitter', async () => {
    vi.useFakeTimers()
    const sockets: FakeSocket[] = []
    const source = createAgentEventSource({
      reconnectDelayMs: 1000,
      maxReconnectDelayMs: 4000,
      random: () => 0,
      createSocket(url) {
        const socket = new FakeSocket(url)
        sockets.push(socket)
        return socket as unknown as WebSocket
      }
    })

    source.subscribe(vi.fn())
    await connected()
    for (const wait of [500, 1000, 2000, 2000]) {
      sockets.at(-1)!.error()
      await vi.advanceTimersByTimeAsync(wait)
      await connected()
    }

    expect(sockets).toHaveLength(5)
  })
})

describe('createAgentEventSource token', () => {
  it('presents the caller credential as ?token=, read afresh on every connect', async () => {
    vi.useFakeTimers()
    const tokens = ['first', 'second']
    const { source, sockets } = sourceHarness(undefined, async () =>
      tokens.shift()
    )

    source.subscribe(vi.fn())
    await connected()
    sockets[0].open()
    sockets[0].close()
    await vi.advanceTimersByTimeAsync(1000)
    await connected()

    expect(new URL(sockets[0].url).searchParams.get('token')).toBe('first')
    expect(new URL(sockets[1].url).searchParams.get('token')).toBe('second')
  })

  it('connects without a token when there is no credential or the read fails', async () => {
    const empty = sourceHarness(undefined, async () => undefined)
    const failing = sourceHarness(undefined, async () => {
      throw new Error('token refresh failed')
    })

    empty.source.subscribe(vi.fn())
    failing.source.subscribe(vi.fn())
    await connected()

    expect(new URL(empty.sockets[0].url).searchParams.has('token')).toBe(false)
    expect(new URL(failing.sockets[0].url).searchParams.has('token')).toBe(
      false
    )
  })

  it('opens nothing when the last listener leaves while the token is read', async () => {
    const { source, sockets } = sourceHarness(undefined, async () => 't')

    source.subscribe(vi.fn())()
    await connected()

    expect(sockets).toHaveLength(0)
  })

  it('opens exactly one socket when a listener returns while the token is read', async () => {
    const { source, sockets } = sourceHarness(undefined, async () => 't')

    source.subscribe(vi.fn())()
    source.subscribe(vi.fn())
    await connected()

    expect(sockets).toHaveLength(1)
  })
})

describe('createAgentEventSource send', () => {
  it('reports false before the socket is open and writes nothing', async () => {
    const { source, sockets } = sourceHarness()
    source.subscribe(vi.fn())
    await connected()
    const socket = sockets[0]
    const send = vi.fn()
    Object.assign(socket, { send })

    expect(source.send('{"type":"doc_subscribe"}')).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })

  it('writes the frame verbatim on the open socket and reports true', async () => {
    const { source, sockets } = sourceHarness()
    source.subscribe(vi.fn())
    await connected()
    const socket = sockets[0]
    const send = vi.fn()
    Object.assign(socket, { send })
    socket.open()

    expect(source.send('{"type":"doc_subscribe"}')).toBe(true)
    expect(send).toHaveBeenCalledWith('{"type":"doc_subscribe"}')
  })
})
