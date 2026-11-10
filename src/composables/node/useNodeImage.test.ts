import { describe, expect, it, vi } from 'vitest'

import { useNodeImage, useNodeVideo } from '@/composables/node/useNodeImage'
import { useTelemetry } from '@comfyorg/telemetry'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useDOMWidgetTestNodes } from '@/renderer/extensions/vueNodes/widgets/composables/domWidgetTestUtils'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isDOMWidget } from '@/scripts/domWidget'
import { fitDimensionsToNodeWidth } from '@/utils/imageUtil'

const createDOMWidgetNode = useDOMWidgetTestNodes()

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
  fitDimensionsToNodeWidth: vi.fn(() => ({ minHeight: 256, minWidth: 256 }))
}))

describe('useNodeVideo', () => {
  function previewElement(node: LGraphNode) {
    const widget = node.widgets?.[0]
    return widget && isDOMWidget(widget) ? widget.element : undefined
  }

  function trackCreatedVideos() {
    const createdVideos: HTMLVideoElement[] = []
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string, opts?: ElementCreationOptions) => {
        const el = realCreateElement(tag, opts)
        if (el instanceof HTMLVideoElement) createdVideos.push(el)
        return el
      }
    )
    return createdVideos
  }

  async function setup() {
    vi.clearAllMocks()

    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      'http://video/1.mp4'
    ])
    const node = createDOMWidgetNode({
      size: [400, 400],
      graph: new LGraph()
    })

    const createdVideos = trackCreatedVideos()

    const { showPreview } = useNodeVideo(node)
    showPreview()

    const video = createdVideos[0]
    video.onloadeddata?.(new Event('loadeddata'))
    await vi.runAllTimersAsync()

    return { node, video, createdVideos }
  }

  async function failBothAttempts(
    createdVideos: HTMLVideoElement[],
    errorCode?: number
  ) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const video = createdVideos.at(-1)!
      if (errorCode) {
        Object.defineProperty(video, 'error', { value: { code: errorCode } })
      }
      video.onerror?.(new Event('error'))
      await vi.advanceTimersByTimeAsync(1)
    }
  }

  it('replaces the previous video with a message when a new output fails to load', async () => {
    const { node, video, createdVideos } = await setup()
    const callback = vi.fn()

    useNodeVideo(node, callback).showPreview()
    await failBothAttempts(createdVideos, 2)

    expect(node.videoContainer?.contains(video)).toBe(false)
    expect(previewElement(node)).toBe(node.videoContainer)
    expect(node.videoContainer?.textContent).toBe('Video failed to load')
    expect(callback).toHaveBeenCalledOnce()
  })

  it('says the browser cannot play a batch where one output is unsupported', async () => {
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      'http://video/a.mov',
      'http://video/b.mp4'
    ])
    const node = createDOMWidgetNode({ size: [400, 400], graph: new LGraph() })
    const createdVideos = trackCreatedVideos()
    const failWith = (video: HTMLVideoElement, code: number) => {
      Object.defineProperty(video, 'error', { value: { code } })
      video.onerror?.(new Event('error'))
    }

    useNodeVideo(node).showPreview()
    failWith(createdVideos[0], 4)
    failWith(createdVideos[1], 2)
    await vi.advanceTimersByTimeAsync(1)
    failWith(createdVideos[2], 4)
    failWith(createdVideos[3], 2)
    await vi.advanceTimersByTimeAsync(1)

    expect(node.videoContainer?.textContent).toContain("can't play this video")
  })

  it('says the browser cannot play a source it does not support', async () => {
    const { node, createdVideos } = await setup()

    useNodeVideo(node).showPreview()
    await failBothAttempts(createdVideos, 4)

    expect(node.videoContainer?.textContent).toBe(
      "Your browser can't play this video. Download it to view it in another app."
    )
  })

  it('shows the message on a node that never previewed a video', async () => {
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      'http://video/1.mov'
    ])
    const node = createDOMWidgetNode({ size: [400, 400], graph: new LGraph() })
    const createdVideos = trackCreatedVideos()

    useNodeVideo(node).showPreview()
    await failBothAttempts(createdVideos, 4)

    expect(previewElement(node)).toBe(node.videoContainer)
    expect(node.videoContainer?.textContent).toContain("can't play this video")
  })

  it.for([
    ['images', { images: [{ filename: 'newer.mp4', type: 'output' }] }],
    ['preview', { preview: ['blob:newer'] }]
  ] as const)(
    'leaves the preview alone when a superseded load fails (new %s)',
    async ([, newerOutput]) => {
      const { node, video, createdVideos } = await setup()

      useNodeVideo(node).showPreview()
      Object.assign(node, newerOutput)
      await failBothAttempts(createdVideos)

      expect(node.videoContainer?.contains(video)).toBe(true)
    }
  )

  it('ignores a superseded load that succeeds late', async () => {
    const { node, video, createdVideos } = await setup()

    useNodeVideo(node).showPreview()
    node.images = [{ filename: 'newer.mp4', type: 'output' }]
    createdVideos.at(-1)!.onloadeddata?.(new Event('loadeddata'))
    await vi.advanceTimersByTimeAsync(1)

    expect(node.videoContainer?.contains(video)).toBe(true)
  })

  it('reports a timed-out load as a plain failure after an unsupported one', async () => {
    const { node, createdVideos } = await setup()
    const { showPreview } = useNodeVideo(node)

    showPreview()
    await failBothAttempts(createdVideos, 4)
    showPreview()
    await vi.runAllTimersAsync()

    expect(node.videoContainer?.textContent).toBe('Video failed to load')
  })

  it('reports a plain failure after an unsupported attempt that recovered', async () => {
    const { node, createdVideos } = await setup()
    const { showPreview } = useNodeVideo(node)

    showPreview()
    const unsupported = createdVideos.at(-1)!
    Object.defineProperty(unsupported, 'error', { value: { code: 4 } })
    unsupported.onerror?.(new Event('error'))
    await vi.advanceTimersByTimeAsync(1)
    createdVideos.at(-1)!.onloadeddata?.(new Event('loadeddata'))
    await vi.advanceTimersByTimeAsync(1)
    showPreview()
    await failBothAttempts(createdVideos, 2)

    expect(node.videoContainer?.textContent).toBe('Video failed to load')
  })

  it('sizes the widget for a video that follows a failure', async () => {
    const node = createDOMWidgetNode({ size: [400, 400], graph: new LGraph() })
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      'http://video/1.mov'
    ])
    const createdVideos = trackCreatedVideos()
    useNodeVideo(node).showPreview()
    await failBothAttempts(createdVideos, 4)

    vi.mocked(fitDimensionsToNodeWidth).mockImplementation(
      (_width, _height, nodeWidth) => ({ minHeight: 700, minWidth: nodeWidth })
    )
    useNodeVideo(node).showPreview()
    createdVideos.at(-1)!.onloadeddata?.(new Event('loadeddata'))
    await vi.advanceTimersByTimeAsync(1)

    expect(node.widgets?.[0]?.computeLayoutSize?.(node)).toEqual({
      minHeight: 700,
      minWidth: 400
    })
  })

  it('keeps the node width fixed when fitted to content after each run', async () => {
    vi.mocked(fitDimensionsToNodeWidth).mockImplementation(
      (width, height, nodeWidth) => ({
        minWidth: nodeWidth,
        minHeight: (nodeWidth * height) / width
      })
    )
    const node = createDOMWidgetNode({ size: [400, 400], graph: new LGraph() })
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      'http://video/1.mp4'
    ])
    const createdVideos = trackCreatedVideos()

    async function runAndLayout() {
      useNodeVideo(node).showPreview()
      const video = createdVideos.at(-1)!
      Object.defineProperties(video, {
        videoWidth: { value: 128 },
        videoHeight: { value: 96 }
      })
      video.onloadeddata?.(new Event('loadeddata'))
      await vi.advanceTimersByTimeAsync(1)
      node.setSize(node.computeSize())
      return [...node.size]
    }

    const first = await runAndLayout()
    expect(await runAndLayout()).toEqual(first)
    expect(await runAndLayout()).toEqual(first)
  })

  it('shows the next good output after a failed one', async () => {
    const { node, createdVideos } = await setup()
    useNodeVideo(node).showPreview()
    await failBothAttempts(createdVideos)

    useNodeVideo(node).showPreview()
    const next = createdVideos.at(-1)!
    next.onloadeddata?.(new Event('loadeddata'))
    await vi.advanceTimersByTimeAsync(1)

    expect(previewElement(node)?.contains(next)).toBe(true)
  })

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

  it('drops the previous image when a new output fails to load', async () => {
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      '/api/view?filename=ok.png&type=output'
    ])
    const created = stubImages()
    const node = createDOMWidgetNode({
      size: [400, 400],
      graph: new LGraph()
    })
    useNodeImage(node).showPreview()
    await flush()
    created[0].onload?.(new Event('load'))
    await flush()
    expect(node.imgs).toEqual([created[0]])

    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      '/api/view?filename=gone.png&type=output'
    ])
    const setDirtyCanvas = vi.spyOn(node.graph!, 'setDirtyCanvas')
    const callback = vi.fn()
    useNodeImage(node, callback).showPreview()
    await flush()
    created[1].onerror?.(new Event('error'))
    await flush()
    created[2].onerror?.(new Event('error'))
    await flush()

    expect(node.imgs).toBeUndefined()
    expect(setDirtyCanvas).toHaveBeenCalled()
    expect(callback).toHaveBeenCalledOnce()
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
