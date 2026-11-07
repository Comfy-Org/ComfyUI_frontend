import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@comfyorg/telemetry'

import type {
  CanvasPresence,
  StarterPromptProfile
} from './starterPromptPersonalization'
import { selectStarterPrompts } from './starterPromptPersonalization'
import { resolveStarterPromptStrategy } from './starterPromptPersonalizationFlag'
import {
  createStarterPromptPersonalizationReporter,
  starterPromptPersonalizationEvent
} from './starterPromptPersonalizationTelemetry'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/utils/devFeatureFlagOverride'))
vi.mock(import('@/utils/sessionFeatureFlagOverride'))

const SURVEY_PROFILE: StarterPromptProfile = {
  intent: 'video',
  experience: 'new'
}

function render(
  options: {
    profile?: StarterPromptProfile | null
    canvasPresence?: CanvasPresence
  } = {}
) {
  const resolution = resolveStarterPromptStrategy()
  return {
    resolution,
    selection: selectStarterPrompts({
      strategy: resolution.strategy,
      profile: options.profile ?? null,
      canvasPresence: options.canvasPresence ?? 'empty'
    })
  }
}

describe('starterPromptPersonalizationEvent', () => {
  it('reports the baseline render with the signals that chose it', () => {
    expect(starterPromptPersonalizationEvent(render())).toEqual({
      strategy: 'static',
      assignment_source: 'inactive',
      personalization_applied: false,
      profile_source: 'unavailable',
      canvas_presence: 'empty',
      catalog_version: 'v2.0-en-draft',
      prompt_count: 5,
      locale: 'en'
    })
  })

  it('never claims a feature assignment while the experiment is inactive', () => {
    const metadata = starterPromptPersonalizationEvent(
      render({ profile: SURVEY_PROFILE, canvasPresence: 'present' })
    )

    expect(
      Object.keys(metadata).filter((key) => key.startsWith('$feature/'))
    ).toEqual([])
  })

  it('separates an unread profile from a strategy that ignores it', () => {
    const served = selectStarterPrompts({
      strategy: 'profile',
      profile: null,
      canvasPresence: 'empty'
    })

    const metadata = starterPromptPersonalizationEvent({
      resolution: {
        strategy: 'profile',
        source: 'qa-override',
        reportsExposure: false
      },
      selection: served
    })

    expect(metadata).toMatchObject({
      strategy: 'profile',
      assignment_source: 'qa-override',
      profile_source: 'unavailable',
      personalization_applied: false
    })
  })

  it('records a personalized set as personalized', () => {
    const metadata = starterPromptPersonalizationEvent({
      resolution: {
        strategy: 'profile_canvas',
        source: 'qa-override',
        reportsExposure: false
      },
      selection: selectStarterPrompts({
        strategy: 'profile_canvas',
        profile: SURVEY_PROFILE,
        canvasPresence: 'present'
      })
    })

    expect(metadata).toMatchObject({
      strategy: 'profile_canvas',
      profile_source: 'survey',
      canvas_presence: 'present',
      personalization_applied: true
    })
  })
})

describe('createStarterPromptPersonalizationReporter', () => {
  let reporter: ReturnType<typeof createStarterPromptPersonalizationReporter>

  beforeEach(() => {
    reporter = createStarterPromptPersonalizationReporter()
  })

  it('sends the rendered set once', () => {
    const telemetry = useTelemetry()!

    expect(reporter.report(render())).not.toBeNull()

    expect(
      telemetry.trackAgentStarterPromptPersonalization
    ).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ strategy: 'static' })
    )
  })

  it('collapses a re-render of the same set', () => {
    const telemetry = useTelemetry()!

    reporter.report(render())
    expect(reporter.report(render())).toBeNull()

    expect(
      telemetry.trackAgentStarterPromptPersonalization
    ).toHaveBeenCalledOnce()
  })

  it('reports again once a signal actually changed', () => {
    const telemetry = useTelemetry()!

    reporter.report({
      resolution: {
        strategy: 'canvas',
        source: 'qa-override',
        reportsExposure: false
      },
      selection: selectStarterPrompts({
        strategy: 'canvas',
        profile: null,
        canvasPresence: 'empty'
      })
    })
    reporter.report({
      resolution: {
        strategy: 'canvas',
        source: 'qa-override',
        reportsExposure: false
      },
      selection: selectStarterPrompts({
        strategy: 'canvas',
        profile: null,
        canvasPresence: 'present'
      })
    })

    expect(
      telemetry.trackAgentStarterPromptPersonalization
    ).toHaveBeenCalledTimes(2)
    expect(
      telemetry.trackAgentStarterPromptPersonalization
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canvas_presence: 'present',
        personalization_applied: true
      })
    )
  })

  it('keeps the set unreported when telemetry is unavailable', () => {
    vi.mocked(useTelemetry).mockReturnValueOnce(null)

    expect(reporter.report(render())).toBeNull()

    const telemetry = useTelemetry()!
    expect(
      telemetry.trackAgentStarterPromptPersonalization
    ).not.toHaveBeenCalled()
    expect(reporter.report(render())).not.toBeNull()
  })
})
