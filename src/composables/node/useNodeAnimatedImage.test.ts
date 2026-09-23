import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { useNodeAnimatedImage } from '@/composables/node/useNodeAnimatedImage'
import { createMockMediaNode } from '@/renderer/extensions/vueNodes/widgets/composables/domWidgetTestUtils'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'

vi.mock(import('@/renderer/core/canvas/useCanvasInteractions'))
vi.mock(import('@/scripts/app'))

let canvasInteractionsMock: ReturnType<typeof useCanvasInteractions>

describe('useNodeAnimatedImage', () => {
  beforeEach(() => {
    canvasInteractionsMock = useCanvasInteractions()
  })

  function setup() {
    vi.clearAllMocks()
    const node = createMockMediaNode({ imgs: [document.createElement('img')] })
    const { showAnimatedPreview, removeAnimatedPreview } =
      useNodeAnimatedImage()
    showAnimatedPreview(node)
    const element = node.widgets[0].element
    document.body.append(element)
    onTestFinished(() => element.remove())
    return { node, element, showAnimatedPreview, removeAnimatedPreview }
  }

  it('forwards non-right-click pointer events and wheel to the canvas while alive', () => {
    const { element } = setup()
    element.dispatchEvent(new WheelEvent('wheel'))
    element.dispatchEvent(new PointerEvent('pointermove'))
    element.dispatchEvent(new PointerEvent('pointerup'))
    element.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }))

    expect(canvasInteractionsMock.handleWheel).toHaveBeenCalledTimes(1)
    expect(canvasInteractionsMock.handlePointerMove).toHaveBeenCalledTimes(1)
    expect(canvasInteractionsMock.handlePointerUp).toHaveBeenCalledTimes(1)
    expect(canvasInteractionsMock.handlePointerDown).toHaveBeenCalledTimes(1)
    expect(canvasInteractionsMock.forwardEventToCanvas).not.toHaveBeenCalled()
  })

  it('routes right-click pointerdown through forwardEventToCanvas, not handlePointerDown', () => {
    const { element } = setup()
    element.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }))

    expect(canvasInteractionsMock.forwardEventToCanvas).toHaveBeenCalledTimes(1)
    expect(canvasInteractionsMock.handlePointerDown).not.toHaveBeenCalled()
  })

  it('detaches every listener when the preview is removed', () => {
    const { node, element, removeAnimatedPreview } = setup()
    removeAnimatedPreview(node)

    element.dispatchEvent(new WheelEvent('wheel'))
    element.dispatchEvent(new PointerEvent('pointermove'))
    element.dispatchEvent(new PointerEvent('pointerup'))
    element.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }))
    element.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }))

    expect(canvasInteractionsMock.handleWheel).not.toHaveBeenCalled()
    expect(canvasInteractionsMock.handlePointerMove).not.toHaveBeenCalled()
    expect(canvasInteractionsMock.handlePointerUp).not.toHaveBeenCalled()
    expect(canvasInteractionsMock.handlePointerDown).not.toHaveBeenCalled()
    expect(canvasInteractionsMock.forwardEventToCanvas).not.toHaveBeenCalled()
  })
})
