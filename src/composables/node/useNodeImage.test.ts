import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { useNodeVideo } from '@/composables/node/useNodeImage'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { createMockMediaNode } from '@/renderer/extensions/vueNodes/widgets/composables/domWidgetTestUtils'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

vi.mock(import('@/renderer/core/canvas/useCanvasInteractions'))
vi.mock(import('@/utils/imageUtil'), () => ({
  fitDimensionsToNodeWidth: () => ({ minHeight: 256, minWidth: 256 })
}))

describe('useNodeVideo', () => {
  async function setup() {
    vi.clearAllMocks()

    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      'http://video/1.mp4'
    ])
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

    expect(useCanvasInteractions().handleWheel).toHaveBeenCalledTimes(1)
    expect(useCanvasInteractions().handlePointerMove).toHaveBeenCalledTimes(1)
    expect(useCanvasInteractions().handlePointerDown).toHaveBeenCalledTimes(1)
  })

  it('detaches every listener when the widget is removed', async () => {
    const { node, video } = await setup()

    node.widgets[0]?.onRemove?.()

    video.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    video.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    video.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(useCanvasInteractions().handleWheel).not.toHaveBeenCalled()
    expect(useCanvasInteractions().handlePointerMove).not.toHaveBeenCalled()
    expect(useCanvasInteractions().handlePointerDown).not.toHaveBeenCalled()
  })
})
