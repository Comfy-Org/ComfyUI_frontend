import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

import { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'

import { hideCanvasInfoOf } from './canvasInfo'

/** Draws its info lines with a method of its class, as the app's canvas does. */
class FakeCanvas {
  linesDrawn = 0
  readonly setDirty = vi.fn()

  renderInfo(): void {
    this.linesDrawn += 1
  }
}

describe('hideCanvasInfoOf', () => {
  it('CP-20: stops the canvas drawing its info lines, and asks it to redraw so they go at once', () => {
    const canvas = new FakeCanvas()

    hideCanvasInfoOf(() => canvas)
    canvas.renderInfo()

    expect(canvas.linesDrawn).toBe(0)
    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('CP-20: the canvas draws them again once the returned function is called', () => {
    const canvas = new FakeCanvas()
    const showAgain = hideCanvasInfoOf(() => canvas)

    showAgain()
    canvas.renderInfo()

    expect(canvas.linesDrawn).toBe(1)
    expect(canvas.setDirty).toHaveBeenCalledTimes(2)
  })

  it('CP-20: waits for a canvas the app has not made yet, and hides its lines when it appears', () => {
    const current = shallowRef<FakeCanvas | null>(null)
    hideCanvasInfoOf(() => current.value)
    const canvas = new FakeCanvas()

    current.value = canvas
    canvas.renderInfo()

    expect(canvas.linesDrawn).toBe(0)
  })

  it('CP-20: when the app replaces its canvas, the new one is hidden and the old one draws again', () => {
    const first = new FakeCanvas()
    const current = shallowRef<FakeCanvas | null>(first)
    hideCanvasInfoOf(() => current.value)
    const second = new FakeCanvas()

    current.value = second
    first.renderInfo()
    second.renderInfo()

    expect(first.linesDrawn).toBe(1)
    expect(second.linesDrawn).toBe(0)
  })

  it('CP-20: once the returned function was called, a canvas that appears later is left alone', () => {
    const current = shallowRef<FakeCanvas | null>(null)
    const showAgain = hideCanvasInfoOf(() => current.value)
    showAgain()
    const canvas = new FakeCanvas()

    current.value = canvas
    canvas.renderInfo()

    expect(canvas.linesDrawn).toBe(1)
  })

  it('CP-20: on the app’s own canvas class the lines are drawn by a method of the class, so they come back when it is given back', () => {
    const drawInfo = vi
      .spyOn(LGraphCanvas.prototype, 'renderInfo')
      .mockImplementation(() => {})
    const canvas: LGraphCanvas = Object.create(LGraphCanvas.prototype)
    const context: CanvasRenderingContext2D = Object.create(null)
    const showAgain = hideCanvasInfoOf(() => canvas)

    canvas.renderInfo(context, 0, 0)
    expect(drawInfo).not.toHaveBeenCalled()

    showAgain()
    canvas.renderInfo(context, 0, 0)
    expect(drawInfo).toHaveBeenCalledTimes(1)
  })
})
