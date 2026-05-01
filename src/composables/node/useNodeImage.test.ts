import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { useNodeVideo } from '@/composables/node/useNodeImage'
import { createMockMediaNode } from '@/renderer/extensions/vueNodes/widgets/composables/domWidgetTestUtils'

const { canvasInteractionsMock, nodeOutputStoreMock } = vi.hoisted(() => ({
  canvasInteractionsMock: {
    handleWheel: vi.fn(),
    handlePointer: vi.fn()
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
  })

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
    expect(canvasInteractionsMock.handlePointer).toHaveBeenCalledTimes(2)
  })

  it('detaches every listener when the widget is removed', async () => {
    const { node, video } = await setup()

    node.widgets[0]?.onRemove?.()

    video.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    video.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    video.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(canvasInteractionsMock.handleWheel).not.toHaveBeenCalled()
    expect(canvasInteractionsMock.handlePointer).not.toHaveBeenCalled()
  })
})
