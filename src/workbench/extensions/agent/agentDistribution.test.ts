import { describe, expect, it, vi } from 'vitest'

import {
  agentConsentScope,
  forwardsComfyCredential,
  hasCloudWorkflowIndex,
  isAgentStandalone
} from './agentDistribution'

describe('agentDistribution', () => {
  it('reports the cloud policies by default', () => {
    expect(isAgentStandalone()).toBe(false)
    expect(hasCloudWorkflowIndex()).toBe(true)
    expect(forwardsComfyCredential()).toBe(false)
    expect(agentConsentScope()).toBe('account')
  })

  it('reports the local agent policies in a standalone build', () => {
    vi.stubEnv('VITE_AGENT_STANDALONE', 'true')

    expect(isAgentStandalone()).toBe(true)
    expect(hasCloudWorkflowIndex()).toBe(false)
    expect(forwardsComfyCredential()).toBe(true)
    expect(agentConsentScope()).toBe('device')
  })
})
