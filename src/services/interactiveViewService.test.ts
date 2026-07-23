import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { addInteractiveViews } from '@/services/interactiveViewService'

const mocks = vi.hoisted(() => {
  const target = new EventTarget()
  return {
    target,
    locatedNode: undefined as LGraphNode | undefined,
    controls: [] as object[],
    serverSupportsFeature: vi.fn(() => true),
    sendInteractionMedia: vi.fn(() => true)
  }
})

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: (type: string, listener: EventListener) =>
      mocks.target.addEventListener(type, listener),
    removeEventListener: (type: string, listener: EventListener) =>
      mocks.target.removeEventListener(type, listener),
    serverSupportsFeature: mocks.serverSupportsFeature,
    sendInteractionControl: (control: object) => {
      mocks.controls.push(control)
      return true
    },
    sendInteractionMedia: mocks.sendInteractionMedia
  }
}))

vi.mock('@/scripts/app', () => ({ app: { rootGraph: {} } }))

vi.mock('@/utils/graphTraversalUtil', () => ({
  executionIdToNodeLocatorId: () => 'locator',
  getNodeByLocatorId: () => mocks.locatedNode
}))

const nodeDef = {
  interactive_ui: [
    {
      id: 'video',
      kind: 'video_stream',
      views: [
        { id: 'source', role: 'local_source', label: 'Webcam' },
        { id: 'result', role: 'remote_output', label: 'Inverted' }
      ]
    }
  ]
} as ComfyNodeDef

function emit(type: string, detail?: object) {
  mocks.target.dispatchEvent(new CustomEvent(type, { detail }))
}

function createNode() {
  let element: HTMLElement | undefined
  const node = {
    id: 12,
    addDOMWidget: vi.fn(
      (_name: string, _type: string, widgetElement: HTMLElement) => {
        element = widgetElement
        return { serialize: true }
      }
    )
  } as unknown as LGraphNode
  mocks.locatedNode = node
  addInteractiveViews(node, nodeDef)
  return { node, element: element! }
}

async function startWebcam(element: HTMLElement) {
  const track = {
    stop: vi.fn(),
    addEventListener: vi.fn()
  }
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track]
  }
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
    stream as unknown as MediaStream
  )
  element.querySelector('button')!.click()
  await vi.waitFor(() =>
    expect(element.textContent).toContain(
      'Webcam ready. Queue the node to stream.'
    )
  )
}

beforeEach(() => {
  mocks.controls.length = 0
  mocks.serverSupportsFeature.mockReturnValue(true)
  mocks.sendInteractionMedia.mockClear()
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn() }
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    writable: true,
    value: null
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('interactive view sessions', () => {
  it('does not request camera access when interactions are unavailable', () => {
    mocks.serverSupportsFeature.mockReturnValue(false)
    const { node, element } = createNode()

    const start = element.querySelector('button')!
    expect(start.hasAttribute('disabled')).toBe(true)
    start.click()
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()

    node.onRemoved?.()
  })

  it('keeps prompt routing stable and resends cancellation after reconnect', async () => {
    const { node, element } = createNode()
    await startWebcam(element)
    const createBitmap = vi.fn().mockResolvedValue({
      width: 1,
      height: 1,
      close: vi.fn()
    })
    vi.stubGlobal('createImageBitmap', createBitmap)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn()
    } as unknown as GPUCanvasContext)

    emit('interaction', {
      v: 1,
      op: 'open',
      interaction_id: 'interaction-a',
      prompt_id: 'prompt-a',
      display_node_id: '12',
      group_id: 'video',
      limits: { max_frame_bytes: 10 }
    })
    expect(mocks.controls).toContainEqual(
      expect.objectContaining({ op: 'ready', prompt_id: 'prompt-a' })
    )

    emit('interaction_media', {
      metadata: {
        v: 1,
        interaction_id: 'interaction-a',
        channel: 'result',
        seq: 0,
        capture_ts_ms: 1,
        mime: 'image/jpeg'
      },
      blob: new Blob([new Uint8Array(1)], { type: 'image/jpeg' })
    })
    await vi.waitFor(() => expect(createBitmap).toHaveBeenCalledOnce())

    const controlCount = mocks.controls.length
    emit('interaction', {
      v: 1,
      op: 'resume',
      interaction_id: 'interaction-a',
      prompt_id: 'prompt-b'
    })
    expect(mocks.controls).toHaveLength(controlCount)

    emit('interaction', {
      v: 1,
      op: 'resume',
      interaction_id: 'interaction-a',
      prompt_id: 'prompt-a'
    })
    emit('interaction_media', {
      metadata: {
        v: 1,
        interaction_id: 'interaction-a',
        channel: 'result',
        seq: 1,
        capture_ts_ms: 2,
        mime: 'image/jpeg'
      },
      blob: new Blob([new Uint8Array(11)], { type: 'image/jpeg' })
    })
    emit('interaction_media', {
      metadata: {
        v: 1,
        interaction_id: 'interaction-a',
        channel: 'result',
        seq: 0,
        capture_ts_ms: 1,
        mime: 'image/jpeg'
      },
      blob: new Blob([new Uint8Array(1)], { type: 'image/jpeg' })
    })
    await Promise.resolve()
    expect(createBitmap).toHaveBeenCalledOnce()

    vi.useFakeTimers()
    emit('reconnecting')
    await vi.advanceTimersByTimeAsync(6500)
    expect(mocks.controls.at(-1)).toMatchObject({
      op: 'cancel',
      prompt_id: 'prompt-a'
    })

    const cancellationCount = mocks.controls.length
    emit('reconnected')
    expect(mocks.controls).toHaveLength(cancellationCount)
    emit('feature_flags')
    expect(mocks.controls.at(-1)).toMatchObject({
      op: 'cancel',
      prompt_id: 'prompt-a'
    })

    node.onRemoved?.()
    await vi.runAllTimersAsync()
  })

  it('cancels an active stream when reconnect negotiation drops support', async () => {
    const { node, element } = createNode()
    await startWebcam(element)
    emit('interaction', {
      v: 1,
      op: 'open',
      interaction_id: 'interaction-b',
      prompt_id: 'prompt-b',
      display_node_id: '12',
      group_id: 'video'
    })

    emit('reconnecting')
    emit('reconnected')
    mocks.serverSupportsFeature.mockReturnValue(false)
    emit('feature_flags')

    expect(mocks.controls.at(-1)).toMatchObject({
      op: 'cancel',
      interaction_id: 'interaction-b',
      prompt_id: 'prompt-b'
    })
    expect(element.textContent).toContain(
      'Interactive streaming is unavailable.'
    )

    emit('interaction', {
      v: 1,
      op: 'closed',
      interaction_id: 'interaction-b',
      prompt_id: 'prompt-b'
    })
    node.onRemoved?.()
  })
})
