import type { ResultItem } from '@comfyorg/api-client/executionTypes'
import { describe, expect, it, vi } from 'vitest'

import { useNodeImage, useNodeVideo } from '@/composables/node/useNodeImage'
import { useTelemetry } from '@comfyorg/telemetry'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useDOMWidgetTestNodes } from '@/renderer/extensions/vueNodes/widgets/composables/domWidgetTestUtils'
import { LGraph } from '@/lib/litegraph/src/litegraph'

const createDOMWidgetNode = useDOMWidgetTestNodes()

vi.mock(import('@/scripts/app'))
vi.mock(import('@/renderer/core/canvas/useCanvasInteractions'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/telemetry/imageFailureDiagnostics'), () => ({
  describeImageLoadFailure: vi.fn(async () => ({
    source: 'node_image_preview' as const,
    probe_outcome: 'probed' as const,
    status: 404
  }))
}))
vi.mock(import('@/utils/imageUtil'), () => ({
  fitDimensionsToNodeWidth: () => ({ minHeight: 256, minWidth: 256 })
}))

describe('useNodeVideo', () => {
  async function setup(
    output: ResultItem = { filename: '1.mp4', type: 'output' }
  ) {
    vi.clearAllMocks()

    vi.mocked(useNodeOutputStore().getNodeOutputs).mockReturnValue({
      images: [output]
    })
    const node = createDOMWidgetNode({
      size: [400, 400],
      graph: new LGraph()
    })

    const createdVideos: HTMLVideoElement[] = []
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string, opts?: ElementCreationOptions) => {
        const el = realCreateElement(tag, opts)
        if (el instanceof HTMLVideoElement) createdVideos.push(el)
        return el
      }
    )

    const { showPreview } = useNodeVideo(node)
    showPreview()

    const video = createdVideos[0]
    video.onloadeddata?.(new Event('loadeddata'))
    await vi.runAllTimersAsync()

    return { node, video }
  }

  it('creates a video-preview widget and forwards canvas events while alive', async () => {
    const { node, video } = await setup()

    expect(node.widgets?.[0]?.name).toBe('video-preview')

    video.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    video.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    video.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(useCanvasInteractions().handleWheel).toHaveBeenCalledTimes(1)
    expect(useCanvasInteractions().handlePointerMove).toHaveBeenCalledTimes(1)
    expect(useCanvasInteractions().handlePointerDown).toHaveBeenCalledTimes(1)
  })

  it('loads the stored preview of a video that has one', async () => {
    const { video } = await setup({
      filename: 'render.mov',
      type: 'output',
      preview_id: 'proxy-1'
    })

    expect(video.getAttribute('src')).toBe(
      '/api/assets/proxy-1/content?disposition=inline'
    )
  })

  it('detaches every listener when the widget is removed', async () => {
    const { node, video } = await setup()

    node.widgets?.[0]?.onRemove?.()

    video.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    video.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    video.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(useCanvasInteractions().handleWheel).not.toHaveBeenCalled()
    expect(useCanvasInteractions().handlePointerMove).not.toHaveBeenCalled()
    expect(useCanvasInteractions().handlePointerDown).not.toHaveBeenCalled()
  })
})

describe('canvas node media failure telemetry', () => {
  function stubImages() {
    const created: HTMLImageElement[] = []
    vi.stubGlobal(
      'Image',
      class extends Image {
        constructor() {
          super()
          created.push(this)
        }
      }
    )
    return created
  }

  // Advances just enough to drain microtasks. `runAllTimersAsync` would fire
  // the 8192ms media timeout and turn an error into a spurious stall.
  const flush = () => vi.advanceTimersByTimeAsync(1)

  it('reports one failure per url after retries are spent, not one per attempt', async () => {
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      '/api/view?filename=gone.png&type=output'
    ])
    const created = stubImages()
    const node = createDOMWidgetNode({
      size: [400, 400],
      graph: new LGraph()
    })

    const { showPreview } = useNodeImage(node)
    showPreview()

    await flush()
    created[0].onerror?.(new Event('error'))
    await flush()
    created[1].onerror?.(new Event('error'))
    await flush()

    expect(created.length).toBe(2)
    expect(useTelemetry()?.trackImageLoadFailed).toHaveBeenCalledTimes(1)
    expect(useTelemetry()?.trackImageLoadFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'canvas_node_image',
        attempts: 2,
        timed_out: false
      })
    )
  })

  it('distinguishes a stalled load from a rejected one', async () => {
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      '/api/view?filename=slow.png&type=output'
    ])
    stubImages()
    const node = createDOMWidgetNode({
      size: [400, 400],
      graph: new LGraph()
    })

    const { showPreview } = useNodeImage(node)
    showPreview()
    await vi.runAllTimersAsync()

    expect(useTelemetry()?.trackImageLoadFailed).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'canvas_node_image', timed_out: true })
    )
  })

  it('stays silent when the image loads', async () => {
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      '/api/view?filename=ok.png&type=output'
    ])
    const created = stubImages()
    const node = createDOMWidgetNode({
      size: [400, 400],
      graph: new LGraph()
    })

    const { showPreview } = useNodeImage(node)
    showPreview()
    await flush()
    created[0].onload?.(new Event('load'))
    await flush()

    expect(useTelemetry()?.trackImageLoadFailed).not.toHaveBeenCalled()
  })
})
