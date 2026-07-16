import { describe, expect, it } from 'vitest'

import {
  clientPointToLetterboxNdc,
  computeLetterboxedViewport,
  isLoad3dActive
} from './load3dViewport'
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

  it.for([
    ['mouseOnNode'],
    ['mouseOnScene'],
    ['mouseOnViewer'],
    ['recording'],
    ['animationPlaying']
  ] as const)('is active when %s is true', ([flag]) => {
    expect(isLoad3dActive({ ...idle, [flag]: true })).toBe(true)
  })
})

describe('clientPointToLetterboxNdc', () => {
  function ndc(x: number, y: number, inside = true) {
    return { x: expect.closeTo(x), y: expect.closeTo(y), inside }
  }

  it('maps the full canvas when no target aspect is set', () => {
    expect(
      clientPointToLetterboxNdc(0.5, 0.5, { width: 400, height: 300 }, null)
    ).toEqual(ndc(0, 0))
    expect(
      clientPointToLetterboxNdc(0, 1, { width: 400, height: 300 }, null)
    ).toEqual(ndc(-1, -1))
  })

  it('maps pillarboxed content edges to -1/1', () => {
    const container = { width: 400, height: 200 }
    expect(clientPointToLetterboxNdc(0.25, 0.5, container, 1)).toEqual(
      ndc(-1, 0)
    )
    expect(clientPointToLetterboxNdc(0.75, 0, container, 1)).toEqual(ndc(1, 1))
    expect(clientPointToLetterboxNdc(0.5, 0.5, container, 1)).toEqual(ndc(0, 0))
  })

  it('extrapolates unclamped NDC marked outside on the letterbox bars', () => {
    const container = { width: 400, height: 200 }
    expect(clientPointToLetterboxNdc(0.1, 0.5, container, 1)).toEqual(
      ndc(-1.6, 0, false)
    )
    expect(clientPointToLetterboxNdc(0.9, 0.5, container, 1)).toEqual(
      ndc(1.6, 0, false)
    )
  })

  it('handles letterbox bars above/below wide content', () => {
    const container = { width: 200, height: 400 }
    expect(clientPointToLetterboxNdc(0.5, 0.375, container, 2)).toEqual(
      ndc(0, 1)
    )
    expect(clientPointToLetterboxNdc(0.5, 0.1, container, 2)).toEqual(
      ndc(0, 3.2, false)
    )
  })

  it('returns null instead of NaN for zero-size containers', () => {
    expect(
      clientPointToLetterboxNdc(0.5, 0.5, { width: 0, height: 0 }, 1)
    ).toBeNull()
    expect(
      clientPointToLetterboxNdc(0.5, 0.5, { width: 0, height: 200 }, 1)
    ).toBeNull()
    expect(
      clientPointToLetterboxNdc(0.5, 0.5, { width: 400, height: 0 }, 1)
    ).toBeNull()
  })
})
