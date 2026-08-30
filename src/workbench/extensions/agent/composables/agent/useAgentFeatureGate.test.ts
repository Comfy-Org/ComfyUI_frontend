import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { api } from '@/scripts/api'

import { useAgentFeatureGate } from './useAgentFeatureGate'

describe('useAgentFeatureGate', () => {
  afterEach(() => {
    api.serverFeatureFlags.value = {}
  })

  it('is false before the server enables the flag', () => {
    api.serverFeatureFlags.value = {}
    expect(useAgentFeatureGate().value).toBe(false)
  })

  it('reacts to true → false server flag transitions', async () => {
    const enabled = useAgentFeatureGate()
    api.serverFeatureFlags.value = { 'agent-in-app-experience': true }
    await nextTick()
    expect(enabled.value).toBe(true)

    api.serverFeatureFlags.value = { 'agent-in-app-experience': false }
    await nextTick()
    expect(enabled.value).toBe(false)
  })
})
