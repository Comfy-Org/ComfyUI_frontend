import { describe, expect, it } from 'vitest'

import { shouldFrameAgentBatch } from './batchFraming'

const VIEWPORT = [0, 0, 1600, 900] as const
const OFFSCREEN_NODE = { pos: [7000, 6500], size: [1000, 400] } as const
const ONSCREEN_NODE = { pos: [1500, 800], size: [400, 300] } as const

describe('shouldFrameAgentBatch', () => {
  it.for([
    {
      name: 'frames a whole-graph batch entirely out of view',
      input: {
        batch: [OFFSCREEN_NODE],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      },
      expected: true
    },
    {
      name: 'leaves the camera alone when any batch node is visible',
      input: {
        batch: [OFFSCREEN_NODE, ONSCREEN_NODE],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      },
      expected: false
    },
    {
      name: 'leaves the camera alone when other nodes are on the canvas',
      input: {
        batch: [OFFSCREEN_NODE],
        nodesNotInBatch: 1,
        viewport: VIEWPORT
      },
      expected: false
    },
    {
      name: 'frames a node that only reaches into the framing padding',
      input: {
        batch: [{ pos: [1610, 0], size: [300, 200] }],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      },
      expected: true
    },
    {
      name: 'frames nodes surrounding the viewport without entering it',
      input: {
        batch: [
          { pos: [-900, -900], size: [300, 300] },
          { pos: [1700, 1000], size: [300, 300] }
        ],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      },
      expected: true
    },
    {
      name: 'does not move when the viewport is absent',
      input: {
        batch: [OFFSCREEN_NODE],
        nodesNotInBatch: 0,
        viewport: null
      },
      expected: false
    },
    {
      name: 'does not move when the viewport width is zero',
      input: {
        batch: [OFFSCREEN_NODE],
        nodesNotInBatch: 0,
        viewport: [0, 0, 0, 0]
      },
      expected: false
    },
    {
      name: 'does not move when the viewport height is zero',
      input: {
        batch: [OFFSCREEN_NODE],
        nodesNotInBatch: 0,
        viewport: [0, 0, 1600, 0]
      },
      expected: false
    },
    {
      name: 'does not move on a viewport with non-finite bounds',
      input: {
        batch: [OFFSCREEN_NODE],
        nodesNotInBatch: 0,
        viewport: [Number.NaN, 0, 1600, 900]
      },
      expected: false
    },
    {
      name: 'does not move for a batch with no nodes',
      input: {
        batch: [],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      },
      expected: false
    },
    {
      name: 'treats an edge-touching batch as off screen',
      input: {
        batch: [{ pos: [1600, 0], size: [400, 300] }],
        nodesNotInBatch: 0,
        viewport: VIEWPORT
      },
      expected: true
    }
  ] as const)('$name', ({ input, expected }) => {
    expect(shouldFrameAgentBatch(input)).toBe(expected)
  })
})
