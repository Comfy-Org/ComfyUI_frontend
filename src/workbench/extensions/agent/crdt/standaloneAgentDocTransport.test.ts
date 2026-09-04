import { describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/api', () => ({
  api: { fetchApi: vi.fn() }
}))

import { createStandaloneAgentDocTransport } from './standaloneAgentDocTransport'

class FakeSocket extends EventTarget {
  readyState: number = WebSocket.CONNECTING

  constructor(readonly url: string) {
    super()
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

  close(): void {
    if (this.readyState === WebSocket.CLOSED) return
    this.readyState = WebSocket.CLOSED
    this.dispatchEvent(new Event('close'))
  }
}

function response(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Bad Request',
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response
}

function harness() {
  const sockets: FakeSocket[] = []
  const request = vi.fn()
  const transport = createStandaloneAgentDocTransport({
    createSocket(url) {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      return socket as unknown as WebSocket
    },
    request,
    reconnectDelayMs: 10
  })
  return { transport, sockets, request }
}

function subscribeFrame(workflowId: string, stateVector = ''): string {
  return JSON.stringify({
    type: 'doc_subscribe',
    data: {
      v: 1,
      workflow_id: workflowId,
      state_vector_b64: stateVector
    }
  })
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('createStandaloneAgentDocTransport', () => {
  it('subscribes the event socket and resyncs only after it opens', async () => {
    const { transport, sockets, request } = harness()
    const subscribed = vi.fn()
    const update = vi.fn()
    transport.addEventListener('doc_subscribed', subscribed)
    transport.addEventListener('doc_update', update)
    request.mockResolvedValue(
      response({ workflow_id: 'wf-1', seq: 7, missing_b64: 'AQID' })
    )

    expect(transport.send(subscribeFrame('wf-1', 'vector'))).toBe(true)
    expect(new URL(sockets[0].url).pathname).toBe('/api/agent/events')
    expect(new URL(sockets[0].url).searchParams.get('workflow_id')).toBe('wf-1')
    expect(request).not.toHaveBeenCalled()

    sockets[0].open()
    await flushPromises()

    expect(request).toHaveBeenCalledWith('/agent/doc/resync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        v: 1,
        workflow_id: 'wf-1',
        state_vector_b64: 'vector'
      })
    })
    expect(subscribed.mock.calls[0][0].detail).toEqual({
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 7
    })
    expect(update.mock.calls[0][0].detail).toEqual({
      v: 1,
      workflow_id: 'wf-1',
      seq: 7,
      update_b64: 'AQID'
    })
  })

  it('forwards live document frames from the event socket', () => {
    const { transport, sockets } = harness()
    const update = vi.fn()
    transport.addEventListener('doc_update', update)
    transport.send(subscribeFrame('wf-1'))

    sockets[0].receive({
      type: 'doc_update',
      data: { v: 1, workflow_id: 'wf-1', seq: 8, update_b64: 'BAUG' }
    })

    expect(update.mock.calls[0][0].detail).toEqual({
      v: 1,
      workflow_id: 'wf-1',
      seq: 8,
      update_b64: 'BAUG'
    })
  })

  it('posts operations and translates their result', async () => {
    const { transport, request } = harness()
    const result = vi.fn()
    transport.addEventListener('doc_ops_result', result)
    transport.send(subscribeFrame('wf-1'))
    request.mockResolvedValue(
      response({
        workflow_id: 'wf-1',
        seq: 9,
        applied: ['op-1'],
        skipped: []
      })
    )
    const data = {
      v: 1,
      workflow_id: 'wf-1',
      tab: 'tab-1',
      ops: [{ op_id: 'op-1', actor: 'human:local-user:tab-1' }]
    }

    expect(transport.send(JSON.stringify({ type: 'doc_ops', data }))).toBe(true)
    await flushPromises()

    expect(request).toHaveBeenCalledWith('/agent/doc/ops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    expect(result.mock.calls[0][0].detail).toEqual({
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 9,
      applied: ['op-1'],
      skipped: []
    })
  })

  it('drops stale responses and frames after retargeting', async () => {
    const { transport, sockets, request } = harness()
    const updates = vi.fn()
    let resolveFirst: (value: Response) => void = () => {}
    request.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = resolve
        })
    )
    request.mockResolvedValueOnce(
      response({ workflow_id: 'wf-2', seq: 2, missing_b64: '' })
    )
    transport.addEventListener('doc_update', updates)
    transport.send(subscribeFrame('wf-1'))
    sockets[0].open()
    transport.send(subscribeFrame('wf-2'))
    sockets[1].open()
    resolveFirst(response({ workflow_id: 'wf-1', seq: 1, missing_b64: 'old' }))
    sockets[0].receive({
      type: 'doc_update',
      data: { v: 1, workflow_id: 'wf-1', seq: 3, update_b64: 'old' }
    })
    await flushPromises()

    expect(updates).not.toHaveBeenCalled()
  })

  it('reconnects and resyncs after the backend socket closes', async () => {
    vi.useFakeTimers()
    const { transport, sockets, request } = harness()
    request.mockResolvedValue(
      response({ workflow_id: 'wf-1', seq: 1, missing_b64: '' })
    )
    transport.addEventListener('doc_update', vi.fn())
    transport.send(subscribeFrame('wf-1', 'vector'))
    sockets[0].open()
    await flushPromises()
    sockets[0].close()

    vi.advanceTimersByTime(10)
    expect(sockets).toHaveLength(2)
    sockets[1].open()
    await flushPromises()

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('reports resync failures and tears down with its final listener', async () => {
    vi.useFakeTimers()
    const { transport, sockets, request } = harness()
    const subscribed = vi.fn()
    request.mockResolvedValue(response({ error: 'denied' }, false, 403))
    transport.addEventListener('doc_subscribed', subscribed)
    transport.send(subscribeFrame('wf-1'))
    sockets[0].open()
    await flushPromises()

    expect(subscribed.mock.calls[0][0].detail).toEqual({
      v: 1,
      workflow_id: 'wf-1',
      ok: false,
      code: '403',
      message: 'denied'
    })

    transport.removeEventListener('doc_subscribed', subscribed)
    expect(sockets[0].readyState).toBe(WebSocket.CLOSED)
    vi.advanceTimersByTime(100)
    expect(sockets).toHaveLength(1)
  })
})
