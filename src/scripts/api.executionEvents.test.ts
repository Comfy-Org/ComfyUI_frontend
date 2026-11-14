import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyApi } from '@comfyorg/api-client/ComfyApi'

class ExecutionSocket extends EventTarget {
  static readonly OPEN = 1
  readyState = ExecutionSocket.OPEN
  binaryType = 'arraybuffer'
  send = vi.fn()
  close = vi.fn()
}

describe('execution websocket events', () => {
  let socket: ExecutionSocket
  let client: ComfyApi

  beforeEach(async () => {
    socket = new ExecutionSocket()
    vi.stubGlobal(
      'WebSocket',
      vi.fn(function () {
        return socket
      })
    )
    client = new ComfyApi({
      isCloud: false,
      featureFlagOverride: () => undefined,
      onFreeMemory: () => {}
    })
    await client.resetSocket()
  })

  afterEach(() => {
    client.socket = null
  })

  it.for([
    { node: '17', display_node: '5:17', legacyNode: '5:17' },
    { node: 23, legacyNode: 23 },
    { node: null, legacyNode: null }
  ])('preserves job identity and the legacy node event for $node', (frame) => {
    const metadata = vi.fn()
    const legacy = vi.fn()
    client.addEventListener('executing_with_metadata', ({ detail }) =>
      metadata(detail)
    )
    client.addEventListener('executing', ({ detail }) => legacy(detail))
    const { legacyNode, ...node } = frame
    const data = {
      ...node,
      prompt_id: 'job-a',
      workflow_id: 'workflow-a'
    }

    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'executing', data })
      })
    )

    expect(metadata).toHaveBeenCalledExactlyOnceWith(data)
    expect(legacy).toHaveBeenCalledExactlyOnceWith(legacyNode)
  })

  it('keeps frames from interleaved jobs separate without requiring a workflow stamp', () => {
    const received: unknown[] = []
    client.addEventListener('executing_with_metadata', ({ detail }) => {
      received.push(detail)
    })
    const frames = [
      { node: '1', prompt_id: 'job-a', workflow_id: 'workflow-a' },
      { node: '1', prompt_id: 'job-b' },
      { node: null, prompt_id: 'job-a', workflow_id: 'workflow-a' }
    ]

    for (const data of frames) {
      socket.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'executing', data })
        })
      )
    }

    expect(received).toEqual(frames)
  })
})
