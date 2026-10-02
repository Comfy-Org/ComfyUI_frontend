import { describe, expect, it } from 'vitest'

import {
  FIT,
  keepInFrame,
  panBy,
  stepZoom,
  wheelFactor,
  zoomAt,
  zoomPercent,
  zoomTransform
} from './zoom'

const frame = { width: 800, height: 600 }

describe('zoomAt', () => {
  it.for([
    { name: 'doubles around the top left', factor: 2, at: { x: 0, y: 0 } },
    { name: 'doubles around the centre', factor: 2, at: { x: 400, y: 300 } },
    { name: 'halves around a corner', factor: 0.5, at: { x: 600, y: 450 } }
  ])('$name, keeping the point under the cursor', ({ factor, at }) => {
    const view = zoomAt(FIT, factor, at, frame)

    expect(view.scale).toBe(factor)
    expect(view.x + at.x * view.scale).toBeCloseTo(at.x)
    expect(view.y + at.y * view.scale).toBeCloseTo(at.y)
  })

  it.for([
    { factor: 100, scale: 4 },
    { factor: 0.001, scale: 0.25 }
  ])('stops at $scale', ({ factor, scale }) => {
    expect(zoomAt(FIT, factor, { x: 0, y: 0 }, frame).scale).toBe(scale)
  })
})

describe('stepZoom', () => {
  it.for([
    { direction: 1 as const, percent: 125 },
    { direction: -1 as const, percent: 80 }
  ])('steps to $percent% around the centre', ({ direction, percent }) => {
    const view = stepZoom(FIT, direction, frame)

    expect(zoomPercent(view)).toBe(percent)
    expect(view.x + 400 * view.scale).toBeCloseTo(400)
  })
})

describe('panBy', () => {
  it('moves the view by the drag', () => {
    expect(panBy({ scale: 2, x: -400, y: -300 }, 50, -20, frame)).toEqual({
      scale: 2,
      x: -350,
      y: -320
    })
  })

  it.for([
    { dx: 5000, dy: 5000, x: 600, y: 450 },
    { dx: -5000, dy: -5000, x: -1400, y: -1050 }
  ])('keeps a quarter of the frame covered', ({ dx, dy, x, y }) => {
    expect(panBy({ scale: 2, x: 0, y: 0 }, dx, dy, frame)).toEqual({
      scale: 2,
      x,
      y
    })
  })
})

describe('keepInFrame', () => {
  it('leaves the fitted view alone', () => {
    expect(keepInFrame(FIT, frame)).toEqual(FIT)
  })
})

describe('wheelFactor', () => {
  it.for([
    { deltaY: -100, zoomsIn: true },
    { deltaY: 100, zoomsIn: false }
  ])('turns a delta of $deltaY into a factor', ({ deltaY, zoomsIn }) => {
    expect(wheelFactor(deltaY) > 1).toBe(zoomsIn)
  })
})

describe('zoomTransform', () => {
  it('pans then scales', () => {
    expect(zoomTransform({ scale: 1.5, x: 10, y: -4 })).toBe(
      'translate(10px, -4px) scale(1.5)'
    )
  })
})
