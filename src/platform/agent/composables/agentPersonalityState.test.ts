import { describe, expect, it } from 'vitest'

import {
  setAgentPersonality,
  useAgentPersonality
} from '@/platform/agent/composables/agentPersonalityState'

describe('agentPersonalityState', () => {
  it('exposes baked-in defaults for shader, hover, and idle params', () => {
    const personality = useAgentPersonality()

    expect(personality.shader).toMatchObject({
      hueBase: 45,
      hueRange: 40,
      speed: 0.6,
      scale: 3,
      intensity: 0.8,
      glow: 0.5
    })
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
      shader: {
        hueBase: 200,
        hueRange: 10,
        speed: 1,
        scale: 5,
        intensity: 1,
        glow: 1
      },
      hover: { scale: 1.2, stiffness: 300, damping: 30 },
      idle: { amplitude: 0.05, period: 2 },
      shimmer: { speed: 1, spread: 10, opacity: 0.5 }
    })

    expect(personality.shader.hueBase).toBe(200)
    expect(personality.hover.scale).toBe(1.2)
    expect(personality.idle.period).toBe(2)
    expect(personality.shimmer.opacity).toBe(0.5)

    // Restore defaults so other tests observing the shared singleton aren't affected.
    setAgentPersonality({
      shader: {
        hueBase: 45,
        hueRange: 40,
        speed: 0.6,
        scale: 3,
        intensity: 0.8,
        glow: 0.5
      },
      hover: { scale: 1.06, stiffness: 260, damping: 20 },
      idle: { amplitude: 0.015, period: 4 },
      shimmer: { speed: 1.8, spread: 20, opacity: 0.9 }
    })
  })

  it('ignores direct mutation attempts on the readonly view', () => {
    const personality = useAgentPersonality()
    const original = personality.shader.hueBase

    // @ts-expect-error verifying runtime readonly enforcement
    personality.shader.hueBase = 999

    expect(personality.shader.hueBase).toBe(original)
  })
})
