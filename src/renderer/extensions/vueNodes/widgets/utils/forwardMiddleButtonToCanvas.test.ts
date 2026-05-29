import { beforeEach, describe, expect, it, vi } from 'vitest'

import { forwardMiddleButtonToCanvas } from '@/renderer/extensions/vueNodes/widgets/utils/forwardMiddleButtonToCanvas'

const { processMouseDown, processMouseMove, processMouseUp } = vi.hoisted(
  () => ({
    processMouseDown: vi.fn(),
    processMouseMove: vi.fn(),
    processMouseUp: vi.fn()
  })
)

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      processMouseDown,
      processMouseMove,
      processMouseUp
    }
  }
}))

describe('forwardMiddleButtonToCanvas', () => {
  let inputEl: HTMLElement
  let controller: AbortController

  beforeEach(() => {
    vi.clearAllMocks()
    inputEl = document.createElement('div')
    controller = new AbortController()
    forwardMiddleButtonToCanvas(inputEl, controller.signal)
  })

  it('uses event-specific middle-button semantics', () => {
    inputEl.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, buttons: 5 })
    )
    inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 5 }))
    inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 1 }))

    expect(processMouseDown).not.toHaveBeenCalled()
    expect(processMouseMove).toHaveBeenCalledTimes(1)
    expect(processMouseUp).toHaveBeenCalledTimes(1)
  })
})
