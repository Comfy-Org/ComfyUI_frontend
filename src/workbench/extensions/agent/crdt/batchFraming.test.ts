import { describe, expect, it } from 'vitest'

import { shouldFrameAgentBatch } from './batchFraming'

// A default-ish camera: the top-left of a fresh canvas, nowhere near a
// template whose author baked in coordinates thousands of px from the origin.
const VIEWPORT = [0, 0, 1600, 900] as const
const OFFSCREEN_BATCH = [7000, 6500, 1000, 400] as const

describe('shouldFrameAgentBatch', () => {
  it('frames a batch that is the whole canvas and entirely out of view', () => {
    expect(
      shouldFrameAgentBatch({
        batch: OFFSCREEN_BATCH,
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      })
    ).toBe(true)
  })

  it('leaves the camera alone when any of the batch is already visible', () => {
    expect(
      shouldFrameAgentBatch({
        batch: [1500, 800, 400, 300],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      })
    ).toBe(false)
  })

  it('leaves the camera alone when the user has their own nodes on the canvas', () => {
    // ADR-CRDT-PLACEMENT-0035 has already parked the batch beside that
    // content, and the user is looking at something they chose.
    expect(
      shouldFrameAgentBatch({
        batch: OFFSCREEN_BATCH,
        nodesNotInBatch: 1,
        viewport: VIEWPORT
      })
    ).toBe(false)
  })

  it('does not move on an unknown camera', () => {
    expect(
      shouldFrameAgentBatch({
        batch: OFFSCREEN_BATCH,
        nodesNotInBatch: 0,
        viewport: null
      })
    ).toBe(false)
  })

  it('does not move for a batch with no measurable extent', () => {
    expect(
      shouldFrameAgentBatch({
        batch: null,
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      })
    ).toBe(false)
    expect(
      shouldFrameAgentBatch({
        batch: [7000, 6500, 0, 0],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      })
    ).toBe(false)
  })

  it('treats an edge-touching batch as off screen', () => {
    // Shares the viewport's right edge exactly: nothing of it is drawn.
    expect(
      shouldFrameAgentBatch({
        batch: [1600, 0, 400, 300],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      })
    ).toBe(true)
  })
})
