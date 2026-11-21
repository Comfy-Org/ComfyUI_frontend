import { describe, expect, it } from 'vitest'

import { assertAgentReplayNodeContract } from '@e2e/fixtures/utils/agentReplayNodeContract'

describe('assertAgentReplayNodeContract', () => {
  it('uses the recorded type as the explicit default title', () => {
    expect(
      assertAgentReplayNodeContract({ type: 'DriftedNode' }, undefined, {
        type: 'DriftedNode',
        hasErrors: false
      })
    ).toBe('DriftedNode')
  })

  it('rejects a missing-node placeholder that preserves the recorded type', () => {
    expect(() =>
      assertAgentReplayNodeContract({ type: 'DriftedNode' }, 'Drifted Node', {
        type: 'DriftedNode',
        hasErrors: true
      })
    ).toThrow('materialized DriftedNode as a missing-node placeholder')
  })

  it('returns the explicit rendered title for a registered node', () => {
    expect(
      assertAgentReplayNodeContract(
        { type: 'CLIPTextEncode', title: 'Negative prompt' },
        'CLIP Text Encode',
        { type: 'CLIPTextEncode', hasErrors: false }
      )
    ).toBe('Negative prompt')
  })
})
