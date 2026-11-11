import { beforeEach, describe, expect, it, vi } from 'vitest'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

import { CHAT_REDESIGN_FLAG, resolveAgentExperience } from './chatRedesign'

vi.mock(import('@/platform/remoteConfig/remoteConfig'))
vi.mock(import('@/utils/devFeatureFlagOverride'))
vi.mock(import('@/utils/sessionFeatureFlagOverride'))

function configWithFlag(value: unknown): RemoteConfig {
  const config: RemoteConfig = {}
  Object.defineProperty(config, CHAT_REDESIGN_FLAG, {
    enumerable: true,
    value
  })
  return config
}

describe('resolveAgentExperience', () => {
  beforeEach(() => {
    remoteConfig.value = {}
  })

  it('is classic when the flag is absent', () => {
    expect(resolveAgentExperience()).toBe('classic')
  })

  it('is the redesign when the remote flag is on', () => {
    remoteConfig.value = { 'agent-chat-redesign': true }

    expect(resolveAgentExperience()).toBe('redesign')
  })

  it.for([false, 'true', 1, null])(
    'stays classic for the remote value %j',
    (value) => {
      remoteConfig.value = configWithFlag(value)

      expect(resolveAgentExperience()).toBe('classic')
    }
  )

  it('lets a dev override turn the redesign on', () => {
    vi.mocked(getDevOverride).mockReturnValue(true)

    expect(resolveAgentExperience()).toBe('redesign')
  })

  it('lets a dev override turn the redesign off over the remote flag', () => {
    remoteConfig.value = { 'agent-chat-redesign': true }
    vi.mocked(getDevOverride).mockReturnValue(false)

    expect(resolveAgentExperience()).toBe('classic')
  })

  it('prefers the session override over the dev override', () => {
    vi.mocked(getDevOverride).mockReturnValue(false)
    vi.mocked(getSessionOverride).mockReturnValue(true)

    expect(resolveAgentExperience()).toBe('redesign')
  })
})
