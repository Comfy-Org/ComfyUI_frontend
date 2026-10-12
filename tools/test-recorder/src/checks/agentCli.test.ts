import { describe, expect, it } from 'vitest'

import { AGENT_CLI_ADAPTERS, detectAgentClis } from './agentCli'

describe('detectAgentClis', () => {
  it('returns nothing when no adapter command is on PATH', () => {
    expect(detectAgentClis(() => false)).toEqual([])
  })

  it('returns only the adapters whose command is on PATH, in preference order', () => {
    const found = detectAgentClis((command) => command === 'codex')
    expect(found).toHaveLength(1)
    expect(found[0].command).toBe('codex')
  })

  it('preserves preference order across every configured adapter', () => {
    const found = detectAgentClis(() => true)
    expect(found.map((a) => a.command)).toEqual(
      AGENT_CLI_ADAPTERS.map((a) => a.command)
    )
  })
})
