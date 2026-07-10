import { describe, expect, it, vi } from 'vitest'

import {
  AGENT_PANEL_FLAG,
  createPostHogFlagSource
} from './useAgentFeatureGate'
import type { PostHogLike } from './useAgentFeatureGate'

function fakePostHog(initial: boolean | undefined): {
  posthog: PostHogLike
  setFlag: (value: boolean | undefined) => void
} {
  let value = initial
  let listener: (() => void) | undefined
  return {
    posthog: {
      isFeatureEnabled: () => value,
      onFeatureFlags: (fn) => {
        listener = fn
        return () => {
          listener = undefined
        }
      }
    },
    setFlag: (next) => {
      value = next
      listener?.()
    }
  }
}

describe('createPostHogFlagSource', () => {
  it('maps an unloaded posthog flag (undefined) to false (fail closed)', () => {
    const { posthog } = fakePostHog(undefined)
    expect(createPostHogFlagSource(posthog).isEnabled()).toBe(false)
  })

  it('notifies onChange listeners and reflects flag flips', () => {
    const { posthog, setFlag } = fakePostHog(undefined)
    const source = createPostHogFlagSource(posthog)
    const onChange = vi.fn()
    source.onChange?.(onChange)

    setFlag(true)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(source.isEnabled()).toBe(true)

    setFlag(false)
    expect(source.isEnabled()).toBe(false)
  })

  it('unsubscribing stops further notifications', () => {
    const { posthog, setFlag } = fakePostHog(undefined)
    const source = createPostHogFlagSource(posthog)
    const onChange = vi.fn()
    const unsubscribe = source.onChange?.(onChange)

    unsubscribe?.()
    setFlag(true)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('tolerates a void-returning onFeatureFlags', () => {
    const posthog: PostHogLike = {
      isFeatureEnabled: () => true,
      onFeatureFlags: vi.fn()
    }
    const source = createPostHogFlagSource(posthog)
    const unsubscribe = source.onChange?.(() => {})
    expect(source.isEnabled()).toBe(true)
    expect(() => unsubscribe?.()).not.toThrow()
  })

  it('queries the agent flag by default', () => {
    const isFeatureEnabled = vi.fn(() => true)
    const source = createPostHogFlagSource({
      isFeatureEnabled,
      onFeatureFlags: () => {}
    })
    expect(source.isEnabled()).toBe(true)
    expect(isFeatureEnabled).toHaveBeenCalledWith(AGENT_PANEL_FLAG)
  })
})
