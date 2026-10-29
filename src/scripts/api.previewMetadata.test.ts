import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyApi } from '@/scripts/api'

/** Minimal socket double; the decoder only needs the `message` handler. */
class FakeWebSocket {
  static readonly OPEN = 1
  static instances: FakeWebSocket[] = []

  readyState = FakeWebSocket.OPEN
  binaryType = ''
  send = vi.fn()
  removeEventListener = vi.fn()
  handlers: Record<string, (event: unknown) => void> = {}
  addEventListener = vi.fn(
    (event: string, handler: (event: unknown) => void) => {
      this.handlers[event] = handler
    }
  )
  close = vi.fn()

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }

  receiveBinary(data: ArrayBuffer) {
    this.handlers['message']?.({ data })
  }
}

/** Encode the type-4 preview frame: tag, metadata length, JSON, image bytes. */
function previewFrame(
  metadata: Record<string, unknown>,
  imageBytes: number[]
): ArrayBuffer {
  const json = new TextEncoder().encode(JSON.stringify(metadata))
  const buffer = new ArrayBuffer(8 + json.byteLength + imageBytes.length)
  const view = new DataView(buffer)
  view.setUint32(0, 4)
  view.setUint32(4, json.byteLength)
  const bytes = new Uint8Array(buffer)
  bytes.set(json, 8)
  bytes.set(imageBytes, 8 + json.byteLength)
  return buffer
}

describe('ComfyApi type-4 preview metadata', () => {
  let api: ComfyApi

  beforeEach(async () => {
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    api = new ComfyApi()
    await api.init()
  })

  afterEach(() => {
    api.socket = null
  })

  function dispatchedPreview(metadata: Record<string, unknown>) {
    const detail = vi.fn()
    api.addEventListener('b_preview_with_metadata', (event) => {
      detail(event.detail)
    })
    FakeWebSocket.instances[0].receiveBinary(previewFrame(metadata, [1, 2, 3]))
    return detail.mock.calls[0]?.[0]
  }

  const baseMetadata = {
    node_id: '1',
    display_node_id: '1',
    parent_node_id: '1',
    real_node_id: '1',
    prompt_id: 'job-1',
    image_type: 'image/png'
  }

  it('decodes the stamped workflow id onto the preview event', () => {
    expect(
      dispatchedPreview({ ...baseMetadata, workflow_id: 'graph-7' })
    ).toMatchObject({ jobId: 'job-1', workflowId: 'graph-7' })
  })

  it('leaves the workflow id undefined when the frame carries none', () => {
    const detail = dispatchedPreview(baseMetadata)

    expect(detail).toMatchObject({ jobId: 'job-1' })
    expect(detail.workflowId).toBeUndefined()
  })
})
