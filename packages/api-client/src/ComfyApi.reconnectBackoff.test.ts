import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyApi } from './ComfyApi'
import type { ComfyApiPorts } from './ComfyApi'

const ports: ComfyApiPorts = {
  isCloud: false,
  featureFlagOverride: () => undefined,
  onFreeMemory: () => {}
}

class FakeWebSocket {
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []
  static failBeforeOpen = false

  readyState = 0
  binaryType = ''
  send = vi.fn()
  handlers: Record<string, (event: unknown) => void> = {}
  addEventListener = vi.fn(
    (event: string, handler: (event: unknown) => void) => {
      this.handlers[event] = handler
    }
  )
  close = vi.fn(() => {
    this.readyState = FakeWebSocket.CLOSED
    this.handlers['close']?.(new Event('close'))
  })

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
    if (FakeWebSocket.failBeforeOpen) queueMicrotask(() => this.close())
  }

  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN
    this.handlers['open']?.(new Event('open'))
  }
}

const latestSocket = () => FakeWebSocket.instances.at(-1)!

async function expectRetryWithin(minMs: number, maxMs: number) {
  const before = FakeWebSocket.instances.length
  await vi.advanceTimersByTimeAsync(minMs - 1)
  expect(FakeWebSocket.instances).toHaveLength(before)
  await vi.advanceTimersByTimeAsync(maxMs - minMs + 1)
  expect(FakeWebSocket.instances).toHaveLength(before + 1)
}

describe('ComfyApi realtime socket reconnect backoff', () => {
  let api: ComfyApi

  beforeEach(async () => {
    FakeWebSocket.instances = []
    FakeWebSocket.failBeforeOpen = false
    vi.stubGlobal('WebSocket', FakeWebSocket)
    api = new ComfyApi(ports)
    await api.resetSocket()
  })

  it('backs off exponentially while connects keep failing before open', async () => {
    latestSocket().close()
    await expectRetryWithin(300, 300)
    latestSocket().close()
    await expectRetryWithin(600, 750)
    latestSocket().close()
    await expectRetryWithin(1200, 1500)
  })

  it('caps the delay at 30s after many failures', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    FakeWebSocket.failBeforeOpen = true
    latestSocket().close()

    const uncappedDelaysMs = 300 + 600 + 1200 + 2400 + 4800 + 9600 + 19_200
    await vi.advanceTimersByTimeAsync(uncappedDelaysMs + 30_000)
    expect(FakeWebSocket.instances).toHaveLength(9)

    await expectRetryWithin(30_000, 30_000)
  })

  it('returns to the 300ms delay once a connect reaches open', async () => {
    latestSocket().close()
    await vi.advanceTimersByTimeAsync(300)
    latestSocket().close()
    await vi.advanceTimersByTimeAsync(750)

    latestSocket().simulateOpen()
    latestSocket().close()

    await expectRetryWithin(300, 300)
  })

  it('reconnects with the counter cleared after an identity reset', async () => {
    latestSocket().close()
    await vi.advanceTimersByTimeAsync(300)
    latestSocket().close()
    await vi.advanceTimersByTimeAsync(750)

    await api.resetSocket()
    latestSocket().close()

    await expectRetryWithin(300, 300)
  })

  it('makes 7 connect attempts in the first 30s of failures without jitter', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    FakeWebSocket.failBeforeOpen = true
    latestSocket().close()

    await vi.advanceTimersByTimeAsync(30_000)

    expect(FakeWebSocket.instances).toHaveLength(7)
  })
})
