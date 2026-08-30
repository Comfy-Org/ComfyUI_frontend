import { beforeEach, describe, expect, it } from 'vitest'

import { api } from '@/scripts/api'

import { useAgentFeatureGate } from './useAgentFeatureGate'

describe('useAgentFeatureGate', () => {
  beforeEach(() => {
    api.serverFeatureFlags.value = {}
  })

  it('reads the canonical server flag synchronously and fail closed', () => {
    const enabled = useAgentFeatureGate()

    expect(enabled.value).toBe(false)
  })

  it('reacts to true and false flag transitions', () => {
    const enabled = useAgentFeatureGate()

    api.serverFeatureFlags.value = { 'agent-in-app-experience': true }
    expect(enabled.value).toBe(true)

    api.serverFeatureFlags.value = { 'agent-in-app-experience': false }
    expect(enabled.value).toBe(false)
  })
})
