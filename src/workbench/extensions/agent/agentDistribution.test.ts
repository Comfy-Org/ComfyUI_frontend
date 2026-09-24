import { describe, expect, it, vi } from 'vitest'

import { isAgentStandalone } from './agentDistribution'

describe('agentDistribution', () => {
  it('reports the cloud policies by default', () => {
    expect(isAgentStandalone()).toBe(false)
  })

  it('reports the local agent policies in a standalone build', () => {
    vi.stubEnv('VITE_AGENT_STANDALONE', 'true')

    expect(isAgentStandalone()).toBe(true)
  })
})
