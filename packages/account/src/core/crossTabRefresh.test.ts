import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AccountCredential } from './session.js'
import { createWebCrossTabRefreshPort } from './crossTabRefresh.js'

class FakeBroadcastChannel {
  static all: FakeBroadcastChannel[] = []
  closed = false
  onmessage: ((event: MessageEvent) => void) | null = null
  private readonly listeners = new Set<(event: MessageEvent) => void>()

  constructor(readonly name: string) {
    FakeBroadcastChannel.all.push(this)
  }

  postMessage(data: unknown): void {
    for (const peer of FakeBroadcastChannel.all) {
      if (peer === this || peer.closed || peer.name !== this.name) continue
      const event = new MessageEvent('message', { data })
      peer.onmessage?.(event)
      peer.listeners.forEach((listener) => listener(event))
    }
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener)
  }

  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener)
  }

  close(): void {
    this.closed = true
  }
}

function testCredential(): AccountCredential {
  return {
    token: 'jwt-1',
    expiresAt: Date.now() + 90 * 60 * 1000,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: []
  }
}

function makePort() {
  const port = createWebCrossTabRefreshPort()
  if (port === undefined) throw new Error('port factory returned undefined')
  return port
}

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  vi.stubGlobal('navigator', {
    locks: { request: vi.fn(async () => undefined) }
  })
})

afterEach(() => {
  FakeBroadcastChannel.all.length = 0
})

describe('createWebCrossTabRefreshPort channel lifecycle', () => {
  it('publishing without a subscriber leaves no channel open', () => {
    const port = makePort()

    port.publishCredential('key-1', testCredential())

    expect(
      FakeBroadcastChannel.all.every((channel) => channel.closed),
      'a publish-only key must not leak a channel nothing will ever close'
    ).toBe(true)
  })

  it('a second subscriber on the same key also receives', () => {
    const port = makePort()
    const first = vi.fn()
    const second = vi.fn()
    port.onCredential('key-1', first)
    port.onCredential('key-1', second)

    new FakeBroadcastChannel('key-1').postMessage(testCredential())

    expect(
      first,
      'a later subscriber must not displace an earlier one'
    ).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })

  it('unsubscribing one listener leaves the other receiving', () => {
    const port = makePort()
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = port.onCredential('key-1', first)
    port.onCredential('key-1', second)

    stopFirst()
    new FakeBroadcastChannel('key-1').postMessage(testCredential())

    expect(first).not.toHaveBeenCalled()
    expect(
      second,
      'closing the shared channel on the FIRST unsubscribe deafens every co-subscriber'
    ).toHaveBeenCalledOnce()
  })

  it('closes the shared channel only after the last unsubscribe', () => {
    const port = makePort()
    const stopFirst = port.onCredential('key-1', vi.fn())
    const stopSecond = port.onCredential('key-1', vi.fn())

    stopFirst()
    expect(
      FakeBroadcastChannel.all.some(
        (channel) => channel.name === 'key-1' && !channel.closed
      )
    ).toBe(true)

    stopSecond()
    expect(FakeBroadcastChannel.all.every((channel) => channel.closed)).toBe(
      true
    )
  })
})
