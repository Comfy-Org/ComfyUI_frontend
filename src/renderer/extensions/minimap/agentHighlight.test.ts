import { describe, expect, it } from 'vitest'

import {
  AGENT_HIGHLIGHT_LIFETIME_MS,
  agentHighlightAt
} from '@/renderer/extensions/minimap/agentHighlight'

const CREATED_AT = 1_000_000

describe('agentHighlightAt', () => {
  it('pops in from nothing to full size', () => {
    const landed = agentHighlightAt(CREATED_AT, CREATED_AT)
    const settling = agentHighlightAt(CREATED_AT, CREATED_AT + 100)
    const settled = agentHighlightAt(CREATED_AT, CREATED_AT + 500)

    expect(landed?.pop).toBe(0)
    expect(settling?.pop).toBeGreaterThan(0)
    expect(settling?.pop).toBeLessThan(1)
    expect(settled?.pop).toBe(1)
  })

  it('holds at full strength before easing away', () => {
    const held = agentHighlightAt(CREATED_AT, CREATED_AT + 2000)
    const fading = agentHighlightAt(
      CREATED_AT,
      CREATED_AT + AGENT_HIGHLIGHT_LIFETIME_MS - 500
    )

    expect(held?.strength).toBe(1)
    expect(fading?.strength).toBeGreaterThan(0)
    expect(fading?.strength).toBeLessThan(1)
  })

  it('stops marking the node once the lifetime is up', () => {
    expect(
      agentHighlightAt(CREATED_AT, CREATED_AT + AGENT_HIGHLIGHT_LIFETIME_MS)
    ).toBeNull()
  })
})
