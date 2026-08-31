/**
 * The production transport must never throw on send.
 *
 * `apiTransport.send` used to `throw new Error('The ComfyUI WebSocket is not
 * connected')` whenever the socket was not OPEN. That single throw was the root
 * cause of BOTH follower defects: it aborted the `watch(..., {immediate:true})`
 * subscribe (Vue swallows watcher errors, so the follower went silently inert)
 * and it aborted `onBeforeUnmount` before `client.destroy()` (leaking four `api`
 * listeners and a projector still wired to the live canvas).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/app', () => ({ app: { graph: null } }))
vi.mock('@/scripts/api', () => ({ api: { socket: null } }))

import { api } from '@/scripts/api'

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
