import { describe, expect, it } from 'vitest'

import {
  nextNodeAskAgentShuffleOffset,
  nodeAskAgentPrompts,
  rotateNodeAskAgentPrompts
} from '@/components/graph/nodeAskAgentPrompts'

describe('nodeAskAgentPrompts', () => {
  it('uses Enhance the prompt as the first partner starter', () => {
    expect(nodeAskAgentPrompts(true).map((prompt) => prompt.id)).toEqual([
      'enhance',
      'fixError',
      'whatElse'
    ])
    expect(nodeAskAgentPrompts(true)[0].fillKey).toBe(
      'agent.nodeHover.enhanceFill'
    )
    expect(nodeAskAgentPrompts(true)[0].icon).toBe(
      'icon-[comfy--text-prompt-enhance]'
    )
  })

  it('keeps regular-node starters without Enhance the prompt', () => {
    expect(nodeAskAgentPrompts(false).map((prompt) => prompt.id)).toEqual([
      'explain',
      'fixError',
      'whatElse'
    ])
  })
})

describe('rotateNodeAskAgentPrompts', () => {
  it('cycles the visible starters from the current offset', () => {
    expect(
      rotateNodeAskAgentPrompts(['explain', 'fixError', 'whatElse'], 1)
    ).toEqual(['fixError', 'whatElse', 'explain'])
    expect(
      rotateNodeAskAgentPrompts(['explain', 'fixError', 'whatElse'], 3)
    ).toEqual(['explain', 'fixError', 'whatElse'])
  })
})

describe('nextNodeAskAgentShuffleOffset', () => {
  it('advances and wraps within the prompt count', () => {
    expect(nextNodeAskAgentShuffleOffset(0, 3)).toBe(1)
    expect(nextNodeAskAgentShuffleOffset(2, 3)).toBe(0)
    expect(nextNodeAskAgentShuffleOffset(4, 0)).toBe(0)
  })
})
