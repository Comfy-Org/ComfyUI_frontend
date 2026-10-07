import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  authenticatedRemoteConfigState,
  remoteConfig,
  remoteConfigRevision
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

import {
  STARTER_PROMPT_SET_FLAG,
  useStarterPromptSet
} from './starterPromptSet'

vi.mock(import('@/platform/remoteConfig/remoteConfig'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/utils/devFeatureFlagOverride'), () => ({
  getDevOverride: vi.fn(() => undefined)
}))
vi.mock(import('@/utils/sessionFeatureFlagOverride'), () => ({
  getSessionOverride: vi.fn(() => undefined)
}))

describe('useStarterPromptSet', () => {
  beforeEach(() => {
    vi.mocked(getSessionOverride).mockReturnValue(undefined)
    authenticatedRemoteConfigState.value = 'unloaded'
    remoteConfig.value = {}
    remoteConfigRevision.value = 0
  })

  it('selects test but waits for the rendered surface before exposure', async () => {
    remoteConfig.value = { [STARTER_PROMPT_SET_FLAG]: 'test' }
    const { assignment, attributeExperiment, expose } = useStarterPromptSet()

    expect(assignment.value).toBe('control')
    expect(attributeExperiment.value).toBe(false)
    expect(
      useTelemetry()?.trackAgentStarterPromptExposure
    ).not.toHaveBeenCalled()

    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfigRevision.value++
    await vi.waitFor(() => expect(assignment.value).toBe('test'))
    expect(attributeExperiment.value).toBe(true)
    expect(
      useTelemetry()?.trackAgentStarterPromptExposure
    ).not.toHaveBeenCalled()

    expose()
    expect(
      useTelemetry()?.trackAgentStarterPromptExposure
    ).toHaveBeenCalledWith({
      [`$feature/${STARTER_PROMPT_SET_FLAG}`]: 'test'
    })
    expose()
    expect(
      useTelemetry()?.trackAgentStarterPromptExposure
    ).toHaveBeenCalledTimes(1)
  })

  it('does not expose a delayed assignment that differs from the rendered surface', async () => {
    remoteConfig.value = { [STARTER_PROMPT_SET_FLAG]: 'test' }
    const { assignment, expose } = useStarterPromptSet()

    expose('control')
    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfigRevision.value++

    await nextTick()
    expect(assignment.value).toBe('control')
    expect(
      useTelemetry()?.trackAgentStarterPromptExposure
    ).not.toHaveBeenCalled()
  })

  it('fails closed to control for missing or unknown assignments', () => {
    Reflect.set(remoteConfig.value, STARTER_PROMPT_SET_FLAG, 'unexpected')
    authenticatedRemoteConfigState.value = 'authenticated'
    const { assignment } = useStarterPromptSet()

    expect(assignment.value).toBe('control')
  })

  it('does not expose an assignment that differs from the rendered surface', () => {
    remoteConfig.value = { [STARTER_PROMPT_SET_FLAG]: 'test' }
    authenticatedRemoteConfigState.value = 'authenticated'
    const { expose } = useStarterPromptSet()

    expose('control')

    expect(
      useTelemetry()?.trackAgentStarterPromptExposure
    ).not.toHaveBeenCalled()
  })

  it.for(['unloaded', 'error'] as const)(
    'defers explicit rendered exposure while authenticated config is %s',
    async (configState) => {
      remoteConfig.value = { [STARTER_PROMPT_SET_FLAG]: 'test' }
      authenticatedRemoteConfigState.value = configState
      const { expose } = useStarterPromptSet()

      expose('test')
      expect(
        useTelemetry()?.trackAgentStarterPromptExposure
      ).not.toHaveBeenCalled()

      authenticatedRemoteConfigState.value = 'authenticated'
      remoteConfigRevision.value++
      await vi.waitFor(() =>
        expect(
          useTelemetry()?.trackAgentStarterPromptExposure
        ).toHaveBeenCalledWith({
          [`$feature/${STARTER_PROMPT_SET_FLAG}`]: 'test'
        })
      )
    }
  )

  it('exposes a surface after authenticated config recovers from an error', async () => {
    remoteConfig.value = { [STARTER_PROMPT_SET_FLAG]: 'test' }
    authenticatedRemoteConfigState.value = 'authenticated'
    const { expose } = useStarterPromptSet()

    authenticatedRemoteConfigState.value = 'error'
    expose('test')
    expect(
      useTelemetry()?.trackAgentStarterPromptExposure
    ).not.toHaveBeenCalled()

    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfigRevision.value++
    await vi.waitFor(() =>
      expect(
        useTelemetry()?.trackAgentStarterPromptExposure
      ).toHaveBeenCalledWith({
        [`$feature/${STARTER_PROMPT_SET_FLAG}`]: 'test'
      })
    )
  })

  it('re-exposes when a remounted surface resolves a new assignment', async () => {
    remoteConfig.value = { [STARTER_PROMPT_SET_FLAG]: 'control' }
    authenticatedRemoteConfigState.value = 'authenticated'
    const { assignment, expose, invalidateSurface } = useStarterPromptSet()

    expose()
    expect(assignment.value).toBe('control')
    expect(
      useTelemetry()?.trackAgentStarterPromptExposure
    ).toHaveBeenCalledTimes(1)

    invalidateSurface()
    remoteConfig.value = { [STARTER_PROMPT_SET_FLAG]: 'test' }
    expose()

    await vi.waitFor(() => expect(assignment.value).toBe('test'))
    expect(
      useTelemetry()?.trackAgentStarterPromptExposure
    ).toHaveBeenLastCalledWith({
      [`$feature/${STARTER_PROMPT_SET_FLAG}`]: 'test'
    })
  })

  it('renders QA overrides without attributing experiment events', () => {
    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfig.value = { [STARTER_PROMPT_SET_FLAG]: 'control' }
    vi.mocked(getSessionOverride).mockReturnValue('test')

    const { assignment, attributeExperiment, expose } = useStarterPromptSet()

    expect(assignment.value).toBe('test')
    expect(attributeExperiment.value).toBe(false)
    expose('test')
    expect(
      useTelemetry()?.trackAgentStarterPromptExposure
    ).not.toHaveBeenCalled()
  })
})
