import { describe, expect, it } from 'vitest'

import { shouldFrameAgentBatch } from './batchFraming'

const VIEWPORT = [0, 0, 1600, 900] as const
const OFFSCREEN_NODE = { pos: [7000, 6500], size: [1000, 400] } as const
const ONSCREEN_NODE = { pos: [1500, 800], size: [400, 300] } as const

describe('shouldFrameAgentBatch', () => {
  it('frames a batch that is the whole graph and entirely out of view', () => {
    expect(
      shouldFrameAgentBatch({
        batch: [OFFSCREEN_NODE],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      })
    ).toBe(true)
  })

  it('leaves the camera alone when any node of the batch is already drawn', () => {
    expect(
      shouldFrameAgentBatch({
        batch: [OFFSCREEN_NODE, ONSCREEN_NODE],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      })
    ).toBe(false)
  })

  it('leaves the camera alone when the user has their own nodes on the canvas', () => {
    expect(
      shouldFrameAgentBatch({
        batch: [OFFSCREEN_NODE],
        nodesNotInBatch: 1,
        viewport: VIEWPORT
      })
    ).toBe(false)
  })

  it('frames a node that only reaches into the framing padding', () => {
    expect(
      shouldFrameAgentBatch({
        batch: [{ pos: [1610, 0], size: [300, 200] }],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      })
    ).toBe(true)
  })

  it('frames a batch whose nodes surround the viewport without entering it', () => {
    expect(
      shouldFrameAgentBatch({
        batch: [
          { pos: [-900, -900], size: [300, 300] },
          { pos: [1700, 1000], size: [300, 300] }
        ],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      })
    ).toBe(true)
  })

  it('does not move when the viewport has not been measured', () => {
    expect(
      shouldFrameAgentBatch({
        batch: [OFFSCREEN_NODE],
        nodesNotInBatch: 0,
        viewport: null
      })
    ).toBe(false)
  })

  it('does not move on a viewport with no measured area', () => {
    expect(
      shouldFrameAgentBatch({
        batch: [OFFSCREEN_NODE],
        nodesNotInBatch: 0,
        viewport: [0, 0, 0, 0]
      })
    ).toBe(false)
    expect(
      shouldFrameAgentBatch({
        batch: [OFFSCREEN_NODE],
        nodesNotInBatch: 0,
        viewport: [0, 0, 1600, 0]
      })
    ).toBe(false)
  })

  it('does not move on a viewport with non-finite bounds', () => {
    expect(
      shouldFrameAgentBatch({
        batch: [OFFSCREEN_NODE],
        nodesNotInBatch: 0,
        viewport: [Number.NaN, 0, 1600, 900]
      })
    ).toBe(false)
  })

  it('does not move for a batch with no nodes', () => {
    expect(
      shouldFrameAgentBatch({
        batch: [],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      })
    ).toBe(false)
  })

  it('treats an edge-touching batch as off screen', () => {
    expect(
      shouldFrameAgentBatch({
        batch: [{ pos: [1600, 0], size: [400, 300] }],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      })
    ).toBe(true)
  })
})
