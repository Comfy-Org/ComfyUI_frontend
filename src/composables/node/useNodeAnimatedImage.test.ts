import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeAnimatedImage } from '@/composables/node/useNodeAnimatedImage'
import { createMockMediaNode } from '@/renderer/extensions/vueNodes/widgets/composables/__tests__/domWidgetTestUtils'

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
  let node: ReturnType<typeof createMockMediaNode>
  let element: HTMLElement
  let showAnimatedPreview: (n: typeof node) => void
  let removeAnimatedPreview: (n: typeof node) => void

  beforeEach(() => {
    vi.clearAllMocks()
    node = createMockMediaNode({ imgs: [document.createElement('img')] })
    ;({ showAnimatedPreview, removeAnimatedPreview } = useNodeAnimatedImage())
    showAnimatedPreview(node)
    element = node.widgets[0].element
    document.body.append(element)
  })

  afterEach(() => element.remove())

  it('forwards non-right-click pointer events and wheel to the canvas while alive', () => {
    element.dispatchEvent(new WheelEvent('wheel'))
    element.dispatchEvent(new PointerEvent('pointermove'))
    element.dispatchEvent(new PointerEvent('pointerup'))
    element.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }))

    expect(canvasInteractionsMock.handleWheel).toHaveBeenCalledTimes(1)
    expect(canvasInteractionsMock.handlePointer).toHaveBeenCalledTimes(3)
    expect(canvasInteractionsMock.forwardEventToCanvas).not.toHaveBeenCalled()
  })

  it('routes right-click pointerdown through forwardEventToCanvas, not handlePointer', () => {
    element.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }))

    expect(canvasInteractionsMock.forwardEventToCanvas).toHaveBeenCalledTimes(1)
    expect(canvasInteractionsMock.handlePointer).not.toHaveBeenCalled()
  })

  it('detaches every listener when the preview is removed', () => {
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
