import { describe, expect, it } from 'vitest'

import { createMockCanvas2DContext } from '@/utils/__tests__/litegraphTestUtils'

import {
  AGENT_MINIMAP_ANIMATION_MS,
  agentMinimapGrowth,
  drawAgentMinimapHighlight
} from './agentMinimapHighlight'

describe('agentMinimapGrowth', () => {
  it.for([
    ['before its stagger', -1, 0],
    ['when placed', 0, 0],
    ['halfway through growth', 130, 0.875],
    ['when settled', AGENT_MINIMAP_ANIMATION_MS, 1],
    ['long after settling', 60_000, 1]
  ] as const)('%s', ([_, elapsed, expected]) => {
    expect(agentMinimapGrowth(1_000, 1_000 + elapsed)).toBe(expected)
  })

  it('centers a settled three-pixel marker on a sub-pixel node', () => {
    const ctx = createMockCanvas2DContext()

    drawAgentMinimapHighlight(
      ctx,
      {
        x: 10,
        y: 20,
        width: 1,
        height: 2
      },
      1
    )

    expect(ctx.fillRect).toHaveBeenCalledWith(9, 19.5, 3, 3)
  })
})
