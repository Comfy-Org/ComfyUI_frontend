import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock<unknown>(import('@/scripts/app'), () => ({ app: { graph: null } }))
vi.mock<unknown>(import('@/scripts/api'), () => ({ api: { socket: null } }))

import { api } from '@/scripts/api'

import { createLoggedTransport } from './agentCrdtTransport'
import { setCrdtDebugEnabled, setCrdtLogLevel } from './crdtDebugGate'
import { clearDevEvents, devEvents, stringifyDevEvents } from './devPanelLog'
import { apiTransport } from './useAgentCrdtFollower'

const mutableApi = fromAny<
  {
    socket: { readyState: number; send: (frame: string) => void } | null
  },
  unknown
>(api)

describe('apiTransport.send', () => {
  beforeEach(() => {
    mutableApi.socket = null
  })

  it('reports failure instead of throwing when there is no socket yet', () => {
    expect(() => apiTransport.send('{}')).not.toThrow()
    expect(apiTransport.send('{}')).toBe(false)
  })

  it('reports failure instead of throwing while the socket is still CONNECTING', () => {
    const send = vi.fn()
    mutableApi.socket = { readyState: WebSocket.CONNECTING, send }
    expect(apiTransport.send('{}')).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })

  it('sends and reports success once the socket is OPEN', () => {
    const send = vi.fn()
    mutableApi.socket = { readyState: WebSocket.OPEN, send }
    expect(apiTransport.send('frame')).toBe(true)
    expect(send).toHaveBeenCalledWith('frame')
  })
})

describe('createLoggedTransport.send', () => {
  const frame = '{"type":"doc_ops"}'

  beforeEach(() => {
    clearDevEvents()
    mutableApi.socket = { readyState: WebSocket.OPEN, send: vi.fn() }
  })

  it('leaves the frame unparsed while the debug instrument is off', () => {
    setCrdtDebugEnabled(false)
    const parse = vi.spyOn(JSON, 'parse')

    expect(createLoggedTransport().send(frame)).toBe(true)

    expect(parse).not.toHaveBeenCalled()
    parse.mockRestore()
  })

  it('records the parsed frame while the instrument is on', () => {
    setCrdtDebugEnabled(true)

    expect(createLoggedTransport().send(frame)).toBe(true)

    expect(devEvents.value.at(-1)?.detail).toEqual({
      delivered: true,
      frame: { type: 'doc_ops' }
    })
  })

  it('redacts outbound frame content in both console and stored events', () => {
    setCrdtDebugEnabled(true)
    setCrdtLogLevel('trace')
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const sensitiveFrame = JSON.stringify({
      type: 'doc_ops',
      token: 'secret-token',
      data: { value: 'secret-prompt', signed_url: 'secret-url' }
    })

    expect(createLoggedTransport().send(sensitiveFrame)).toBe(true)

    expect(debug.mock.calls.at(-1)?.at(-1)).toEqual({
      delivered: true,
      frame: {
        type: 'doc_ops',
        token: '[REDACTED]',
        data: { value: '[REDACTED]', signed_url: '[REDACTED]' }
      }
    })
    expect(devEvents.value.at(-1)?.detail).toEqual(
      debug.mock.calls.at(-1)?.at(-1)
    )
    expect(JSON.stringify(debug.mock.calls)).not.toContain('secret-prompt')
    expect(JSON.stringify(debug.mock.calls)).not.toContain('secret-url')
    expect(JSON.stringify(devEvents.value)).not.toContain('secret-prompt')
    debug.mockRestore()
  })

  it('keeps an unparsed outbound frame out of the buffer and the copied report', () => {
    setCrdtDebugEnabled(true)
    const transport = createLoggedTransport()

    expect(transport.send('not json')).toBe(true)
    expect(transport.send('[1,2]')).toBe(true)
    expect(transport.send('null')).toBe(true)
    expect(transport.send('Bearer sk-live-secret')).toBe(true)

    expect(devEvents.value.map((event) => event.detail)).toEqual([
      { delivered: true, frame: null, unparsed_chars: 8 },
      { delivered: true, frame: null, unparsed_chars: 5 },
      { delivered: true, frame: null, unparsed_chars: 4 },
      { delivered: true, frame: null, unparsed_chars: 21 }
    ])
    const copied = stringifyDevEvents(devEvents.value)
    expect(copied).not.toContain('not json')
    expect(copied).not.toContain('sk-live-secret')
  })
})
