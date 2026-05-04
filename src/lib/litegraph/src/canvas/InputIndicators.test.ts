import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { InputIndicators } from '@/lib/litegraph/src/canvas/InputIndicators'

// Minimal LGraphCanvas-shaped fake good enough for InputIndicators' constructor
// and the handlers we exercise. The class touches `canvas.canvas` (DOM element),
// `canvas.drawFrontCanvas`, and `canvas.setDirty`; nothing else on the handler
// paths under test.
function createFakeCanvas() {
  const element = document.createElement('canvas')
  const origDrawFrontCanvas = vi.fn()
  return {
    canvas: element,
    drawFrontCanvas: origDrawFrontCanvas,
    setDirty: vi.fn()
  } as unknown as LGraphCanvas
}

describe('InputIndicators.onPointerDownOrMove', () => {
  let canvas: LGraphCanvas
  let indicators: InputIndicators

  beforeEach(() => {
    canvas = createFakeCanvas()
    indicators = new InputIndicators(canvas)
  })

  it('flags mouse1Down when only middle is held (buttons=4)', () => {
    indicators.onPointerDownOrMove(
      new MouseEvent('pointermove', { buttons: 4 })
    )

    expect(indicators.mouse0Down).toBe(false)
    expect(indicators.mouse1Down).toBe(true)
    expect(indicators.mouse2Down).toBe(false)
  })

  it('keeps mouse1Down while middle is chorded with left (buttons=5)', () => {
    indicators.onPointerDownOrMove(
      new MouseEvent('pointermove', { buttons: 5 })
    )

    expect(indicators.mouse0Down).toBe(true)
    expect(indicators.mouse1Down).toBe(true)
    expect(indicators.mouse2Down).toBe(false)
  })

  it('keeps mouse1Down while middle is chorded with right (buttons=6)', () => {
    indicators.onPointerDownOrMove(
      new MouseEvent('pointermove', { buttons: 6 })
    )

    expect(indicators.mouse0Down).toBe(false)
    expect(indicators.mouse1Down).toBe(true)
    expect(indicators.mouse2Down).toBe(true)
  })

  it('keeps mouse1Down while all three buttons are held (buttons=7)', () => {
    indicators.onPointerDownOrMove(
      new MouseEvent('pointermove', { buttons: 7 })
    )

    expect(indicators.mouse0Down).toBe(true)
    expect(indicators.mouse1Down).toBe(true)
    expect(indicators.mouse2Down).toBe(true)
  })

  it('clears mouse1Down when middle is not in buttons (left only, buttons=1)', () => {
    indicators.onPointerDownOrMove(
      new MouseEvent('pointermove', { buttons: 1 })
    )

    expect(indicators.mouse0Down).toBe(true)
    expect(indicators.mouse1Down).toBe(false)
    expect(indicators.mouse2Down).toBe(false)
  })

  it('clears all flags when no buttons are held (buttons=0)', () => {
    // Prime with middle held, then send a no-buttons event (e.g., after release).
    indicators.onPointerDownOrMove(
      new MouseEvent('pointermove', { buttons: 4 })
    )
    expect(indicators.mouse1Down).toBe(true)

    indicators.onPointerDownOrMove(
      new MouseEvent('pointermove', { buttons: 0 })
    )
    expect(indicators.mouse0Down).toBe(false)
    expect(indicators.mouse1Down).toBe(false)
    expect(indicators.mouse2Down).toBe(false)
  })

  it('captures the pointer position and marks canvas dirty', () => {
    indicators.onPointerDownOrMove(
      new MouseEvent('pointermove', { clientX: 123, clientY: 456, buttons: 4 })
    )

    expect(indicators.x).toBe(123)
    expect(indicators.y).toBe(456)
    expect(canvas.setDirty).toHaveBeenCalledWith(true)
  })
})

describe('InputIndicators.onPointerUp', () => {
  it('clears all mouse-down flags', () => {
    const canvas = createFakeCanvas()
    const indicators = new InputIndicators(canvas)

    indicators.onPointerDownOrMove(
      new MouseEvent('pointermove', { buttons: 7 })
    )
    expect(indicators.mouse1Down).toBe(true)

    indicators.onPointerUp()

    expect(indicators.mouse0Down).toBe(false)
    expect(indicators.mouse1Down).toBe(false)
    expect(indicators.mouse2Down).toBe(false)
  })
})
