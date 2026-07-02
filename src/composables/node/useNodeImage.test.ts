import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { useNodeImage, useNodeVideo } from '@/composables/node/useNodeImage'
import { createMockMediaNode } from '@/renderer/extensions/vueNodes/widgets/composables/domWidgetTestUtils'

const { canvasInteractionsMock, nodeOutputStoreMock } = vi.hoisted(() => ({
  canvasInteractionsMock: {
    handleWheel: vi.fn(),
    handlePointerDown: vi.fn(),
    handlePointerMove: vi.fn()
  },
  nodeOutputStoreMock: {
    getNodeImageUrls: vi.fn<(node: unknown) => string[] | undefined>()
  }
}))

vi.mock('@/renderer/core/canvas/useCanvasInteractions', () => ({
  useCanvasInteractions: () => canvasInteractionsMock
}))
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => nodeOutputStoreMock
}))
vi.mock('@/utils/imageUtil', () => ({
  fitDimensionsToNodeWidth: () => ({ minHeight: 256, minWidth: 256 })
}))

describe('useNodeVideo', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function installMockImage() {
    const images: HTMLImageElement[] = []
    class MockImage {
      onload: ((event: Event) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      src = ''

      constructor() {
        images.push(this as unknown as HTMLImageElement)
      }
    }
    vi.stubGlobal('Image', MockImage)
    return images
  }

  async function setup() {
    vi.clearAllMocks()
    vi.useFakeTimers()

    nodeOutputStoreMock.getNodeImageUrls.mockReturnValue(['http://video/1.mp4'])
    const node = createMockMediaNode({
      size: [400, 400],
      graph: { setDirtyCanvas: vi.fn() }
    })

    const createdVideos: HTMLVideoElement[] = []
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string, opts?: ElementCreationOptions) => {
        const el = realCreateElement(tag, opts)
        if (tag === 'video') createdVideos.push(el as HTMLVideoElement)
        return el
      }
    )

    const { showPreview } = useNodeVideo(node)
    showPreview()

    // happy-dom does not auto-fire onloadeddata for src assignment, so we
    // manually trigger it, then drain the resulting promise chain.
    const video = createdVideos[0]
    video.onloadeddata?.(new Event('loadeddata'))
    await vi.runAllTimersAsync()

    onTestFinished(() => {
      node.widgets[0]?.onRemove?.()
    })

    return { node, video }
  }

  it('creates a video-preview widget and forwards canvas events while alive', async () => {
    const { node, video } = await setup()

    expect(node.widgets[0]?.name).toBe('video-preview')

    video.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    video.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    video.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(canvasInteractionsMock.handleWheel).toHaveBeenCalledTimes(1)
    expect(canvasInteractionsMock.handlePointerMove).toHaveBeenCalledTimes(1)
    expect(canvasInteractionsMock.handlePointerDown).toHaveBeenCalledTimes(1)
  })

  it('detaches every listener when the widget is removed', async () => {
    const { node, video } = await setup()

    node.widgets[0]?.onRemove?.()

    video.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    video.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    video.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(canvasInteractionsMock.handleWheel).not.toHaveBeenCalled()
    expect(canvasInteractionsMock.handlePointerMove).not.toHaveBeenCalled()
    expect(canvasInteractionsMock.handlePointerDown).not.toHaveBeenCalled()
  })

  it('loads image previews and marks the graph dirty', async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    const images = installMockImage()
    const graph = { setDirtyCanvas: vi.fn() }
    const node = createMockMediaNode({ graph })
    const callback = vi.fn()
    nodeOutputStoreMock.getNodeImageUrls.mockReturnValue(['http://image/1.png'])

    const { showPreview } = useNodeImage(node, callback)
    showPreview({ block: true })
    images[0].onload?.(new Event('load'))
    await vi.runAllTimersAsync()

    expect(node.previewMediaType).toBe('image')
    expect(node.imageIndex).toBeNull()
    expect(node.imgs).toEqual([images[0]])
    expect(node.isLoading).toBe(false)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(graph.setDirtyCanvas).toHaveBeenCalledWith(true)
  })

  it('does not start image loads while already loading or without output URLs', () => {
    vi.clearAllMocks()
    const images = installMockImage()
    const node = createMockMediaNode()
    const { showPreview } = useNodeImage(node)

    node.isLoading = true
    showPreview()
    node.isLoading = false
    nodeOutputStoreMock.getNodeImageUrls.mockReturnValue(undefined)
    showPreview()

    expect(images).toHaveLength(0)
  })

  it('retries image loading once when the first load fails', async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    const images = installMockImage()
    const graph = { setDirtyCanvas: vi.fn() }
    const node = createMockMediaNode({ graph })
    nodeOutputStoreMock.getNodeImageUrls.mockReturnValue([
      'http://image/missing.png'
    ])

    const staleImgs = [document.createElement('img')]
    node.imgs = staleImgs

    const { showPreview } = useNodeImage(node)
    showPreview()
    images[0].onerror?.(new Event('error'))
    await Promise.resolve()
    await Promise.resolve()
    images[1].onerror?.(new Event('error'))
    await vi.runAllTimersAsync()

    expect(images).toHaveLength(2)
    // Failed loads never resolve to elements, so existing previews are untouched
    expect(node.imgs).toBe(staleImgs)
    expect(graph.setDirtyCanvas).not.toHaveBeenCalled()
    expect(node.isLoading).toBe(false)
  })

  it('reuses an existing video-preview widget when loading a video', async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    nodeOutputStoreMock.getNodeImageUrls.mockReturnValue(['http://video/1.mp4'])
    const node = createMockMediaNode({
      graph: { setDirtyCanvas: vi.fn() }
    })
    node.widgets.push({
      name: 'video-preview',
      element: document.createElement('div')
    })
    const callback = vi.fn()

    const createdVideos: HTMLVideoElement[] = []
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string, opts?: ElementCreationOptions) => {
        const el = realCreateElement(tag, opts)
        if (tag === 'video') createdVideos.push(el as HTMLVideoElement)
        return el
      }
    )

    const { showPreview } = useNodeVideo(node, callback)
    showPreview()
    const video = createdVideos[0]
    video.onloadeddata?.(new Event('loadeddata'))
    await vi.runAllTimersAsync()

    expect(node.addDOMWidget).not.toHaveBeenCalled()
    expect(node.videoContainer?.firstChild).toBe(video)
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
