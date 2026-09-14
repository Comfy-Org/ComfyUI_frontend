/**
 * The standalone doc transport rides the SAME socket as the chat stream, the
 * way the cloud transport rides ComfyUI's one socket. It must forward outbound
 * frames verbatim and surface inbound document frames as events, while leaving
 * chat frames to the chat listeners.
 */
import { describe, expect, it, vi } from 'vitest'

import type { StandaloneAgentEventSource } from '../services/agent/standaloneAgentEventSource'
import { createStandaloneDocFrameTransport } from './standaloneDocFrameTransport'

function fakeSource() {
  const listeners = new Set<(raw: unknown) => void>()
  const statusListeners = new Set<(live: boolean) => void>()
  const send = vi.fn((_frame: string) => true)
  const source: StandaloneAgentEventSource = {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onStatus(listener) {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
    send
  }
  return {
    source,
    send,
    receive(frame: unknown) {
      listeners.forEach((listener) => listener(frame))
    },
    status(live: boolean) {
      statusListeners.forEach((listener) => listener(live))
    },
    listenerCount: () => listeners.size
  }
}

describe('createStandaloneDocFrameTransport', () => {
  it('sends outbound doc frames on the shared socket verbatim', () => {
    const fake = fakeSource()
    const transport = createStandaloneDocFrameTransport(fake.source)

    expect(transport.send('{"type":"doc_subscribe","data":{}}')).toBe(true)
    expect(fake.send).toHaveBeenCalledWith('{"type":"doc_subscribe","data":{}}')
  })

  it('reports the socket state instead of throwing', () => {
    const fake = fakeSource()
    fake.send.mockReturnValue(false)
    const transport = createStandaloneDocFrameTransport(fake.source)

    expect(() => transport.send('{}')).not.toThrow()
    expect(transport.send('{}')).toBe(false)
  })

  it('surfaces an inbound doc_update as an event carrying its data', () => {
    const fake = fakeSource()
    const transport = createStandaloneDocFrameTransport(fake.source)
    const seen = vi.fn()
    transport.addEventListener('doc_update', (event) =>
      seen((event as CustomEvent).detail)
    )

    fake.receive({
      type: 'doc_update',
      data: { workflow_id: 'wf-1', seq: 2, update_b64: 'AQID' }
    })

    expect(seen).toHaveBeenCalledWith({
      workflow_id: 'wf-1',
      seq: 2,
      update_b64: 'AQID'
    })
  })

  it('does not surface chat frames to doc listeners', () => {
    const fake = fakeSource()
    const transport = createStandaloneDocFrameTransport(fake.source)
    const seen = vi.fn()
    transport.addEventListener('doc_update', seen)

    fake.receive({ type: 'agent_message_delta', data: { delta: 'hi' } })

    expect(seen).not.toHaveBeenCalled()
  })

  it('reports when the shared socket becomes usable, so a dropped subscribe can be re-driven', () => {
    // A subscribe sent while the socket is still connecting is dropped by
    // design. In the cloud the follower re-drives it off ComfyUI's own socket
    // events; those never fire for the agent socket, so this transport has
    // to say when ITS socket opened.
    const fake = fakeSource()
    const transport = createStandaloneDocFrameTransport(fake.source)
    const connected = vi.fn()
    transport.onConnected(connected)

    fake.status(true)
    expect(connected).toHaveBeenCalledTimes(1)

    fake.status(false)
    expect(connected).toHaveBeenCalledTimes(1)

    fake.status(true)
    expect(connected).toHaveBeenCalledTimes(2)
  })

  it('stops listening once destroyed', () => {
    const fake = fakeSource()
    const transport = createStandaloneDocFrameTransport(fake.source)
    transport.addEventListener('doc_update', vi.fn())
    expect(fake.listenerCount()).toBe(1)

    transport.destroy()

    expect(fake.listenerCount()).toBe(0)
  })
})
