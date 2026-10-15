import { afterEach, describe, expect, it, vi } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'

import { ComfyApi } from '@/scripts/api'
import { reportError } from '@/platform/telemetry/reportError'

import { DocFrameClient } from './docFrameClient'
import { setCrdtDebugEnabled, setCrdtLogLevel } from './crdtDebugGate'
import { clearDevEvents, devEvents } from './devPanelLog'

vi.mock(import('@/platform/telemetry/reportError'))

describe('document frames through api', () => {
  afterEach(() => {
    setCrdtDebugEnabled(false)
    clearDevEvents()
  })

  it.for([
    undefined,
    WebSocket.CONNECTING,
    WebSocket.CLOSING,
    WebSocket.CLOSED
  ])('refuses to send when socket state is %s', (readyState) => {
    const api = new ComfyApi()
    const send = vi.fn()
    api.socket =
      readyState === undefined
        ? null
        : fromPartial<WebSocket>({ readyState, send })
    expect(
      api.sendDocFrame({
        type: 'doc_unsubscribe',
        data: { v: 1, workflow_id: 'wf' }
      })
    ).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })

  it('refuses unserializable workflows without sending a frame', () => {
    const api = new ComfyApi()
    const send = vi.fn()
    api.socket = fromPartial<WebSocket>({ readyState: WebSocket.OPEN, send })

    expect(
      api.sendDocFrame({
        type: 'doc_reseed',
        data: { v: 1, workflow_id: 'wf', expected_seq: 7, workflow: { id: 1n } }
      })
    ).toBe(false)
    expect(send).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'failure_sending_agent_doc_frame' })
    )
  })

  it('serializes typed frames and redacts the outbound diagnostic', () => {
    const api = new ComfyApi()
    const send = vi.fn()
    api.socket = fromPartial<WebSocket>({ readyState: WebSocket.OPEN, send })
    const client = new DocFrameClient(api)
    setCrdtDebugEnabled(true)
    setCrdtLogLevel('trace')

    expect(client.reseed('wf', 7, { value: 'secret-prompt' })).toBe(true)
    expect(send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'doc_reseed',
        data: {
          v: 1,
          workflow_id: 'wf',
          expected_seq: 7,
          workflow: { value: 'secret-prompt' }
        }
      })
    )
    expect(devEvents.value.at(-1)?.detail).toMatchObject({
      delivered: true,
      frame: { type: 'doc_reseed' }
    })
    expect(JSON.stringify(devEvents.value)).not.toContain('secret-prompt')
    expect(JSON.stringify(vi.mocked(console.debug).mock.calls)).not.toContain(
      'secret-prompt'
    )
    client.destroy()
  })

  it('routes socket frames to registered clients and removes a destroyed client', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', class extends EventTarget {})
    const api = new ComfyApi()
    await api.init()
    const first = new DocFrameClient(api)
    const second = new DocFrameClient(api)
    const firstListener = vi.fn()
    const secondListener = vi.fn()
    first.addEventListener('doc_reset', firstListener)
    second.addEventListener('doc_reset', secondListener)
    const event = new MessageEvent('message', {
      data: JSON.stringify({
        type: 'doc_reset',
        data: { v: 1, workflow_id: 'wf', seq: 43, lineage_seq: 7 }
      })
    })
    api.socket?.dispatchEvent(event)
    first.destroy()
    first.destroy()
    api.socket?.dispatchEvent(event)
    expect(firstListener).toHaveBeenCalledTimes(1)
    expect(secondListener).toHaveBeenCalledTimes(2)
    expect(secondListener.mock.calls[0][0].detail).toEqual({
      workflowId: 'wf',
      seq: 43,
      lineageSeq: 7
    })
    second.destroy()
    api.socket?.dispatchEvent(event)
    expect(secondListener).toHaveBeenCalledTimes(2)
    api.socket = null
  })
})
