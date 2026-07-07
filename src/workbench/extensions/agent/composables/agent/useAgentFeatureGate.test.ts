import { describe, expect, it, vi } from 'vitest'

import {
  AGENT_PANEL_FLAG,
  createPostHogFlagSource,
  useAgentFeatureGate
} from './useAgentFeatureGate'
import type { AgentFlagSource, PostHogLike } from './useAgentFeatureGate'

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

describe('useAgentFeatureGate', () => {
  it('fails closed when the source reports disabled', () => {
    const source: AgentFlagSource = { isEnabled: () => false }
    const { enabled } = useAgentFeatureGate(source)
    expect(enabled.value).toBe(false)
  })

  it('maps an unloaded posthog flag (undefined) to false', () => {
    const { posthog } = fakePostHog(undefined)
    const { enabled } = useAgentFeatureGate(createPostHogFlagSource(posthog))
    expect(enabled.value).toBe(false)
  })

  it('flips on when flags load and the listener fires, then off on a later change', () => {
    const { posthog, setFlag } = fakePostHog(undefined)
    const { enabled } = useAgentFeatureGate(createPostHogFlagSource(posthog))
    expect(enabled.value).toBe(false)

    setFlag(true)
    expect(enabled.value).toBe(true)

    setFlag(false)
    expect(enabled.value).toBe(false)
  })

  it('dispose stops further updates', () => {
    const { posthog, setFlag } = fakePostHog(undefined)
    const { enabled, dispose } = useAgentFeatureGate(
      createPostHogFlagSource(posthog)
    )
    dispose()
    setFlag(true)
    expect(enabled.value).toBe(false)
  })

  it('tolerates a void-returning onFeatureFlags', () => {
    const posthog: PostHogLike = {
      isFeatureEnabled: () => true,
      onFeatureFlags: vi.fn()
    }
    const { enabled, dispose } = useAgentFeatureGate(
      createPostHogFlagSource(posthog)
    )
    expect(enabled.value).toBe(true)
    expect(() => dispose()).not.toThrow()
  })

  it('createPostHogFlagSource queries the agent flag by default', () => {
    const isFeatureEnabled = vi.fn(() => true)
    const source = createPostHogFlagSource({
      isFeatureEnabled,
      onFeatureFlags: () => {}
    })
    expect(source.isEnabled()).toBe(true)
    expect(isFeatureEnabled).toHaveBeenCalledWith(AGENT_PANEL_FLAG)
  })
})
