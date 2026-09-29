import { beforeEach, describe, expect, it, vi } from 'vitest'

import { forwardMiddleButtonToCanvas } from '@/renderer/extensions/vueNodes/widgets/utils/forwardMiddleButtonToCanvas'
import { app } from '@/scripts/app'

vi.mock(import('@/scripts/app'))

describe('forwardMiddleButtonToCanvas', () => {
  let inputEl: HTMLElement
  let controller: AbortController

  beforeEach(() => {
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

    expect(app.canvas.processMouseDown).not.toHaveBeenCalled()
    expect(app.canvas.processMouseMove).toHaveBeenCalledTimes(1)
    expect(app.canvas.processMouseUp).toHaveBeenCalledTimes(1)
  })
})
