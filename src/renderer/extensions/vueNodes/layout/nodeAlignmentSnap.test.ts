import { describe, expect, it } from 'vitest'

import { resolveNodeAlignmentSnap } from './nodeAlignmentSnap'

describe('resolveNodeAlignmentSnap', () => {
  const selectionBounds = {
    x: 0,
    y: 0,
    width: 100,
    height: 80
  }

  it('snaps matching edges within threshold', () => {
    const result = resolveNodeAlignmentSnap({
      selectionBounds,
      candidateBounds: [
        {
          x: 200,
          y: 0,
          width: 100,
          height: 80
        }
      ],
      delta: { x: 193, y: 0 },
      zoomScale: 1
    })

    expect(result.delta).toEqual({ x: 200, y: 0 })
    expect(result.guides).toContainEqual({
      axis: 'vertical',
      coordinate: 200,
      start: 0,
      end: 80
    })
  })

  it('snaps matching centers within threshold', () => {
    const result = resolveNodeAlignmentSnap({
      selectionBounds,
      candidateBounds: [
        {
          x: 0,
          y: 200,
          width: 100,
          height: 80
        }
      ],
      delta: { x: 0, y: 196 },
      zoomScale: 1
    })

    expect(result.delta).toEqual({ x: 0, y: 200 })
    expect(result.guides).toContainEqual({
      axis: 'horizontal',
      coordinate: 200,
      start: 0,
      end: 100
    })
  })

  it('prefers the nearest candidate correction', () => {
    const result = resolveNodeAlignmentSnap({
      selectionBounds,
      candidateBounds: [
        {
          x: 200,
          y: 0,
          width: 100,
          height: 80
        },
        {
          x: 198,
          y: 0,
          width: 100,
          height: 80
        }
      ],
      delta: { x: 193, y: 0 },
      zoomScale: 1
    })

    expect(result.delta).toEqual({ x: 198, y: 0 })
    expect(result.guides).toContainEqual({
      axis: 'vertical',
      coordinate: 198,
      start: 0,
      end: 80
    })
  })

  it('does not snap when outside the zoom-adjusted threshold', () => {
    const result = resolveNodeAlignmentSnap({
      selectionBounds,
      candidateBounds: [
        {
          x: 200,
          y: 200,
          width: 100,
          height: 80
        }
      ],
      delta: { x: 183, y: 0 },
      zoomScale: 0.5
    })

    expect(result.delta).toEqual({ x: 183, y: 0 })
    expect(result.guides).toEqual([])
  })

  it('tightens the canvas threshold as zoom increases', () => {
    const result = resolveNodeAlignmentSnap({
      selectionBounds,
      candidateBounds: [
        {
          x: 200,
          y: 200,
          width: 100,
          height: 80
        }
      ],
      delta: { x: 195, y: 0 },
      zoomScale: 2
    })

    expect(result.delta).toEqual({ x: 195, y: 0 })
    expect(result.guides).toEqual([])
  })
})
