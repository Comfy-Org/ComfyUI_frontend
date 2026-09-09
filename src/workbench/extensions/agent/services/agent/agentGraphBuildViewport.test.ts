import { describe, expect, it } from 'vitest'

import { graphBuildCameraTarget } from './agentGraphBuildViewport'

describe('graph build viewport', () => {
  it('fits generated nodes beside the sidebar without changing graph coordinates', () => {
    const bounds = [80, 90, 960, 260] as const
    const viewport = [360, 100, 630, 470] as const
    const target = graphBuildCameraTarget(bounds, viewport, {
      offset: [0, 0],
      scale: 0.9
    })
    expect(target).not.toBeNull()
    if (!target) throw new Error('Expected a camera adjustment')
    const [x, y, width, height] = bounds
    const screenX = (x + target.offset[0]) * target.scale
    const screenY = (y + target.offset[1]) * target.scale
    expect(screenX).toBeGreaterThanOrEqual(viewport[0])
    expect(screenY).toBeGreaterThanOrEqual(viewport[1])
    expect(screenX + width * target.scale).toBeLessThanOrEqual(990)
    expect(screenY + height * target.scale).toBeLessThanOrEqual(570)
    expect(bounds).toEqual([80, 90, 960, 260])
  })

  it('leaves a user camera alone when the nodes already fit', () => {
    expect(
      graphBuildCameraTarget([80, 100, 240, 180], [40, 80, 800, 500], {
        offset: [50, 20],
        scale: 0.8
      })
    ).toBeNull()
  })

  it('fits again after the visible canvas shrinks', () => {
    const bounds = [80, 90, 960, 260] as const
    const initial = { offset: [0, 0] as [number, number], scale: 1 }
    const first = graphBuildCameraTarget(bounds, [360, 100, 630, 470], initial)
    const second = graphBuildCameraTarget(
      bounds,
      [360, 100, 380, 320],
      first ?? initial
    )
    expect(second).not.toBeNull()
    expect(second?.scale).toBeLessThan(first?.scale ?? initial.scale)
  })

  it('ignores a hidden or zero-sized viewport', () => {
    expect(
      graphBuildCameraTarget([0, 0, 100, 100], [0, 0, 0, 0], {
        offset: [0, 0],
        scale: 1
      })
    ).toBeNull()
  })
})
