import { describe, expect, it } from 'vitest'

import { computeLetterboxedViewport, isLoad3dActive } from './load3dViewport'
import type { Load3dActivityFlags } from './load3dViewport'

describe('computeLetterboxedViewport', () => {
  it('pillarboxes when the container is wider than the target aspect', () => {
    const viewport = computeLetterboxedViewport({ width: 800, height: 400 }, 1)

    expect(viewport).toEqual({
      offsetX: 200,
      offsetY: 0,
      width: 400,
      height: 400
    })
  })

  it('letterboxes when the container is taller than the target aspect', () => {
    const viewport = computeLetterboxedViewport({ width: 400, height: 800 }, 1)

    expect(viewport).toEqual({
      offsetX: 0,
      offsetY: 200,
      width: 400,
      height: 400
    })
  })

  it('fills the container when aspect ratios match exactly', () => {
    const viewport = computeLetterboxedViewport(
      { width: 1024, height: 768 },
      1024 / 768
    )

    expect(viewport.offsetX).toBe(0)
    expect(viewport.offsetY).toBe(0)
    expect(viewport.width).toBe(1024)
    expect(viewport.height).toBe(768)
  })

  it('handles a wide target aspect inside a square container', () => {
    const viewport = computeLetterboxedViewport(
      { width: 600, height: 600 },
      16 / 9
    )

    expect(viewport.offsetX).toBe(0)
    expect(viewport.width).toBe(600)
    expect(viewport.height).toBeCloseTo(337.5)
    expect(viewport.offsetY).toBeCloseTo((600 - 337.5) / 2)
  })

  it('handles a tall target aspect inside a square container', () => {
    const viewport = computeLetterboxedViewport(
      { width: 600, height: 600 },
      9 / 16
    )

    expect(viewport.offsetY).toBe(0)
    expect(viewport.height).toBe(600)
    expect(viewport.width).toBeCloseTo(337.5)
    expect(viewport.offsetX).toBeCloseTo((600 - 337.5) / 2)
  })

  it('preserves the target aspect ratio in the returned rect', () => {
    const target = 16 / 9
    const wide = computeLetterboxedViewport(
      { width: 1920, height: 500 },
      target
    )
    const tall = computeLetterboxedViewport(
      { width: 500, height: 1920 },
      target
    )

    expect(wide.width / wide.height).toBeCloseTo(target)
    expect(tall.width / tall.height).toBeCloseTo(target)
  })
})

describe('isLoad3dActive', () => {
  const idle: Load3dActivityFlags = {
    mouseOnNode: false,
    mouseOnScene: false,
    mouseOnViewer: false,
    recording: false,
    initialRenderDone: true,
    animationPlaying: false
  }

  it('is inactive once the first frame is rendered with nothing happening', () => {
    expect(isLoad3dActive(idle)).toBe(false)
  })

  it('is active before the first frame renders', () => {
    expect(isLoad3dActive({ ...idle, initialRenderDone: false })).toBe(true)
  })

  it.each([
    ['mouseOnNode'],
    ['mouseOnScene'],
    ['mouseOnViewer'],
    ['recording'],
    ['animationPlaying']
  ] as const)('is active when %s is true', (flag) => {
    expect(isLoad3dActive({ ...idle, [flag]: true })).toBe(true)
  })
})
