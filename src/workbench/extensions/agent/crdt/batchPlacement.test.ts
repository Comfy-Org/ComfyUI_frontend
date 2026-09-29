import { describe, expect, it } from 'vitest'

import type { PlacementRect } from './batchPlacement'
import {
  DISCONNECTED_GAP_PX,
  PLACEMENT_GUTTER_PX,
  placementOffset
} from './batchPlacement'

const rect = (
  x: number,
  y: number,
  width = 200,
  height = 100
): PlacementRect => ({ x, y, width, height })

describe('placementOffset', () => {
  it.for([
    {
      name: 'empty canvas keeps the batch layout',
      existing: [],
      viewport: null,
      incoming: [rect(9000, 9000)]
    },
    {
      name: 'a batch with no new nodes has nothing to move',
      existing: [rect(0, 0)],
      viewport: null,
      incoming: []
    },
    {
      name: 'a batch overlapping existing content stays put',
      existing: [rect(0, 0)],
      viewport: null,
      incoming: [rect(100, 50)]
    },
    {
      name: 'a batch within the gap of existing content stays put',
      existing: [rect(0, 0)],
      viewport: null,
      incoming: [rect(200 + DISCONNECTED_GAP_PX - 1, 0)]
    },
    {
      name: 'a far batch visible in the viewport stays put',
      existing: [rect(0, 0)],
      viewport: rect(8500, 8500, 2000, 1500),
      incoming: [rect(9000, 9000)]
    }
  ])('$name', ({ existing, viewport, incoming }) => {
    expect(placementOffset({ existing, viewport, incoming })).toBeNull()
  })

  it.for([
    {
      name: 'a far offscreen batch, no viewport known',
      viewport: null
    },
    {
      name: 'a far offscreen batch, viewport elsewhere',
      viewport: rect(-500, -500, 1200, 900)
    }
  ])('moves $name beside existing content', ({ viewport }) => {
    expect(
      placementOffset({
        existing: [rect(0, 0)],
        viewport,
        incoming: [rect(9000, 9000)]
      })
    ).toEqual({ dx: 200 + PLACEMENT_GUTTER_PX - 9000, dy: -9000 })
  })

  it('fires at exactly the gap threshold', () => {
    expect(
      placementOffset({
        existing: [rect(0, 0)],
        viewport: null,
        incoming: [rect(200 + DISCONNECTED_GAP_PX, 0)]
      })
    ).toEqual({ dx: -DISCONNECTED_GAP_PX + PLACEMENT_GUTTER_PX, dy: 0 })
  })

  it('fires on vertical-only separation', () => {
    expect(
      placementOffset({
        existing: [rect(0, 0)],
        viewport: null,
        incoming: [rect(0, 5000)]
      })
    ).toEqual({ dx: 200 + PLACEMENT_GUTTER_PX, dy: -5000 })
  })

  it('translates the whole batch hull, preserving relative layout', () => {
    const offset = placementOffset({
      existing: [rect(0, 0, 100, 100), rect(300, 200, 100, 100)],
      viewport: null,
      incoming: [rect(5000, 5000, 100, 100), rect(5200, 5100, 100, 100)]
    })
    expect(offset).toEqual({
      dx: 400 + PLACEMENT_GUTTER_PX - 5000,
      dy: -5000
    })
  })
})
