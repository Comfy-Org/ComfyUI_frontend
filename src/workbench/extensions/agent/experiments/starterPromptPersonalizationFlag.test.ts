import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

import {
  INACTIVE_STARTER_PROMPT_STRATEGY,
  STARTER_PROMPT_PERSONALIZATION_FLAG,
  STARTER_PROMPT_STRATEGIES,
  resolveStarterPromptStrategy
} from './starterPromptPersonalizationFlag'

vi.mock(import('@/utils/devFeatureFlagOverride'))
vi.mock(import('@/utils/sessionFeatureFlagOverride'))

const devOverride = vi.mocked(getDevOverride)
const sessionOverride = vi.mocked(getSessionOverride)

describe('resolveStarterPromptStrategy', () => {
  beforeEach(() => {
    devOverride.mockReturnValue(undefined)
    sessionOverride.mockReturnValue(undefined)
  })

  it('resolves to the inactive static baseline with no override set', () => {
    expect(resolveStarterPromptStrategy()).toEqual({
      strategy: INACTIVE_STARTER_PROMPT_STRATEGY,
      source: 'inactive',
      reportsExposure: false
    })
  })

  it.for(STARTER_PROMPT_STRATEGIES)(
    'resolves the %s employee session override without reporting exposure',
    (strategy) => {
      sessionOverride.mockReturnValue(strategy)

      expect(resolveStarterPromptStrategy()).toEqual({
        strategy,
        source: 'qa-override',
        reportsExposure: false
      })
    }
  )

  it('resolves the dev override when no session override is set', () => {
    devOverride.mockReturnValue('profile_canvas')

    expect(resolveStarterPromptStrategy()).toEqual({
      strategy: 'profile_canvas',
      source: 'qa-override',
      reportsExposure: false
    })
  })

  it('prefers the session override over the dev override', () => {
    sessionOverride.mockReturnValue('canvas')
    devOverride.mockReturnValue('profile')

    expect(resolveStarterPromptStrategy().strategy).toBe('canvas')
  })

  it.for([
    { name: 'an unrecognized strategy', value: 'personalized' },
    { name: 'a boolean on-switch', value: true },
    { name: 'an empty string', value: '' },
    { name: 'null', value: null }
  ])('falls back to the baseline for $name', ({ value }) => {
    sessionOverride.mockReturnValue(value)

    expect(resolveStarterPromptStrategy()).toEqual({
      strategy: INACTIVE_STARTER_PROMPT_STRATEGY,
      source: 'inactive',
      reportsExposure: false
    })
  })

  it('reads both overrides under the experiment flag key', () => {
    resolveStarterPromptStrategy()

    expect(sessionOverride).toHaveBeenCalledWith(
      STARTER_PROMPT_PERSONALIZATION_FLAG
    )
    expect(devOverride).toHaveBeenCalledWith(
      STARTER_PROMPT_PERSONALIZATION_FLAG
    )
  })
})
