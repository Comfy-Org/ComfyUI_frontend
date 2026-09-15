import { describe, expect, it } from 'vitest'

import {
  AGENT_POP_MS,
  agentHighlightAt
} from '@/renderer/extensions/minimap/agentHighlight'

const CREATED_AT = 1_000_000

describe('agentHighlightAt', () => {
  it('pops in from nothing to full size', () => {
    expect(agentHighlightAt(CREATED_AT, CREATED_AT).pop).toBe(0)

    const settling = agentHighlightAt(CREATED_AT, CREATED_AT + AGENT_POP_MS / 2)
    expect(settling.pop).toBeGreaterThan(0)
    expect(settling.pop).toBeLessThan(1)

    expect(agentHighlightAt(CREATED_AT, CREATED_AT + AGENT_POP_MS).pop).toBe(1)
  })

  it('holds at nothing until a staggered stamp comes due', () => {
    expect(agentHighlightAt(CREATED_AT, CREATED_AT - 500).pop).toBe(0)
  })

  it('keeps marking the node long after it landed', () => {
    expect(agentHighlightAt(CREATED_AT, CREATED_AT + 60 * 60_000).pop).toBe(1)
  })
})
