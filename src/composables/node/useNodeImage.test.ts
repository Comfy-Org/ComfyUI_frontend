import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeVideo } from '@/composables/node/useNodeImage'
import { createMockMediaNode } from '@/renderer/extensions/vueNodes/widgets/composables/__tests__/domWidgetTestUtils'

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
  let node: ReturnType<typeof createMockMediaNode>
  let video: HTMLVideoElement

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    nodeOutputStoreMock.getNodeImageUrls.mockReturnValue(['http://video/1.mp4'])
    node = createMockMediaNode({
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
    video = createdVideos[0]
    video.onloadeddata?.(new Event('loadeddata'))
    await vi.runAllTimersAsync()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('creates a video-preview widget and forwards canvas events while alive', () => {
    expect(node.widgets[0]?.name).toBe('video-preview')

    video.dispatchEvent(new WheelEvent('wheel'))
    video.dispatchEvent(new PointerEvent('pointermove'))
    video.dispatchEvent(new PointerEvent('pointerdown'))

    expect(canvasInteractionsMock.handleWheel).toHaveBeenCalledTimes(1)
    expect(canvasInteractionsMock.handlePointer).toHaveBeenCalledTimes(2)
  })

  it('detaches every listener when the widget is removed', () => {
    node.widgets[0]?.onRemove?.()

    video.dispatchEvent(new WheelEvent('wheel'))
    video.dispatchEvent(new PointerEvent('pointermove'))
    video.dispatchEvent(new PointerEvent('pointerdown'))

    expect(canvasInteractionsMock.handleWheel).not.toHaveBeenCalled()
    expect(canvasInteractionsMock.handlePointer).not.toHaveBeenCalled()
  })
})
