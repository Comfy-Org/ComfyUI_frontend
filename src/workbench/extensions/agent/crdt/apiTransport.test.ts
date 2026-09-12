import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock<unknown>(import('@/scripts/app'), () => ({ app: { graph: null } }))
vi.mock<unknown>(import('@/scripts/api'), () => ({ api: { socket: null } }))

import { api } from '@/scripts/api'

import { createLoggedTransport } from './agentCrdtTransport'
import { setCrdtDebugEnabled } from './crdtDebugGate'
import { clearDevEvents, devEvents } from './devPanelLog'
import { apiTransport } from './useAgentCrdtFollower'

const mutableApi = api as unknown as {
  socket: { readyState: number; send: (frame: string) => void } | null
}

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
})
