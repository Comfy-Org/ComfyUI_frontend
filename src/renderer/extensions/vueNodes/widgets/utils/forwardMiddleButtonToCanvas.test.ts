import { beforeEach, describe, expect, it, vi } from 'vitest'

import { forwardMiddleButtonToCanvas } from '@/renderer/extensions/vueNodes/widgets/utils/forwardMiddleButtonToCanvas'

const processMouseDown = vi.fn()
const processMouseMove = vi.fn()
const processMouseUp = vi.fn()

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      processMouseDown: (e: Event) => processMouseDown(e),
      processMouseMove: (e: Event) => processMouseMove(e),
      processMouseUp: (e: Event) => processMouseUp(e)
    }
  }
}))

describe('forwardMiddleButtonToCanvas', () => {
  let inputEl: HTMLElement

  beforeEach(() => {
    vi.clearAllMocks()
    inputEl = document.createElement('div')
    forwardMiddleButtonToCanvas(inputEl)
  })

  describe('pointerdown — strict semantic', () => {
    it('forwards a middle-button pointerdown', () => {
      inputEl.dispatchEvent(
        new PointerEvent('pointerdown', { button: 1, buttons: 4 })
      )
      expect(processMouseDown).toHaveBeenCalledTimes(1)
    })

    it('does NOT forward a chorded pointerdown (left pressed while middle held)', () => {
      // button=0 (left), buttons=5 (middle + left). Strict semantics on
      // pointerdown must reject — user is left-clicking, not middle-clicking.
      inputEl.dispatchEvent(
        new PointerEvent('pointerdown', { button: 0, buttons: 5 })
      )
      expect(processMouseDown).not.toHaveBeenCalled()
    })

    it('does NOT forward a left pointerdown', () => {
      inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }))
      expect(processMouseDown).not.toHaveBeenCalled()
    })

    it('does NOT forward a right pointerdown', () => {
      inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }))
      expect(processMouseDown).not.toHaveBeenCalled()
    })
  })

  describe('pointermove — held/bitmask semantic', () => {
    it('forwards a middle-only pointermove', () => {
      inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 4 }))
      expect(processMouseMove).toHaveBeenCalledTimes(1)
    })

    it('forwards a pointermove when middle is chorded with left (buttons=5)', () => {
      inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 5 }))
      expect(processMouseMove).toHaveBeenCalledTimes(1)
    })

    it('forwards a pointermove when middle is chorded with right (buttons=6)', () => {
      inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 6 }))
      expect(processMouseMove).toHaveBeenCalledTimes(1)
    })

    it('does NOT forward a pointermove with no middle bit held', () => {
      inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 1 }))
      expect(processMouseMove).not.toHaveBeenCalled()
    })
  })

  describe('pointerup — button field semantic', () => {
    it('forwards a middle-button pointerup even if buttons is already 0', () => {
      inputEl.dispatchEvent(
        new PointerEvent('pointerup', { button: 1, buttons: 0 })
      )
      expect(processMouseUp).toHaveBeenCalledTimes(1)
    })

    it('does NOT forward a left pointerup', () => {
      inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 0 }))
      expect(processMouseUp).not.toHaveBeenCalled()
    })
  })
})
