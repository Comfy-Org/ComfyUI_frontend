import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { useNodeAnimatedImage } from '@/composables/node/useNodeAnimatedImage'
import { createMockMediaNode } from '@/renderer/extensions/vueNodes/widgets/composables/domWidgetTestUtils'

const { canvasInteractionsMock } = vi.hoisted(() => ({
  canvasInteractionsMock: {
    handleWheel: vi.fn(),
    handlePointer: vi.fn(),
    forwardEventToCanvas: vi.fn()
  }
}))

vi.mock('@/renderer/core/canvas/useCanvasInteractions', () => ({
  useCanvasInteractions: () => canvasInteractionsMock
}))
// `@/scripts/app` has a heavy import graph (pinia stores, LGraphCanvas, etc.)
// that we cannot pull in here, so we stub only the constant we need.
vi.mock('@/scripts/app', () => ({
  ANIM_PREVIEW_WIDGET: '$$comfy_animation_preview'
}))

describe('useNodeAnimatedImage', () => {
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
    expect(canvasInteractionsMock.handlePointer).toHaveBeenCalledTimes(3)
    expect(canvasInteractionsMock.forwardEventToCanvas).not.toHaveBeenCalled()
  })

  it('routes right-click pointerdown through forwardEventToCanvas, not handlePointer', () => {
    const { element } = setup()
    element.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }))

    expect(canvasInteractionsMock.forwardEventToCanvas).toHaveBeenCalledTimes(1)
    expect(canvasInteractionsMock.handlePointer).not.toHaveBeenCalled()
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
    expect(canvasInteractionsMock.handlePointer).not.toHaveBeenCalled()
    expect(canvasInteractionsMock.forwardEventToCanvas).not.toHaveBeenCalled()
  })
})
