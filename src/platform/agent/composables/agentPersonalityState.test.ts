import { describe, expect, it } from 'vitest'

import {
  setAgentPersonality,
  useAgentPersonality
} from '@/platform/agent/composables/agentPersonalityState'

describe('agentPersonalityState', () => {
  it('exposes baked-in defaults for hover, idle, and shimmer params', () => {
    const personality = useAgentPersonality()

    expect(personality.hover).toMatchObject({
      scale: 1.06,
      stiffness: 260,
      damping: 20
    })
    expect(personality.idle).toMatchObject({ amplitude: 0.015, period: 4 })
    expect(personality.shimmer).toMatchObject({
      speed: 1.8,
      spread: 20,
      opacity: 0.9
    })
  })

  it('mirrors live values from setAgentPersonality into the shared state', () => {
    const personality = useAgentPersonality()

    setAgentPersonality({
      hover: { scale: 1.2, stiffness: 300, damping: 30 },
      idle: { amplitude: 0.05, period: 2 },
      shimmer: { speed: 1, spread: 10, opacity: 0.5 }
    })

    expect(personality.hover.scale).toBe(1.2)
    expect(personality.idle.period).toBe(2)
    expect(personality.shimmer.opacity).toBe(0.5)

    // Restore defaults so other tests observing the shared singleton aren't affected.
    setAgentPersonality({
      hover: { scale: 1.06, stiffness: 260, damping: 20 },
      idle: { amplitude: 0.015, period: 4 },
      shimmer: { speed: 1.8, spread: 20, opacity: 0.9 }
    })
  })

  it('ignores direct mutation attempts on the readonly view', () => {
    const personality = useAgentPersonality()
    const original = personality.hover.scale

    // @ts-expect-error verifying runtime readonly enforcement
    personality.hover.scale = 999

    expect(personality.hover.scale).toBe(original)
  })
})
