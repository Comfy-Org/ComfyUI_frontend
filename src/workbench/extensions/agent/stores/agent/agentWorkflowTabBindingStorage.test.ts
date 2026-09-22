import { describe, expect, it } from 'vitest'

import { MAX_AGENT_STORAGE_CLOCK_SKEW_MS } from '@/workbench/extensions/agent/persistenceTime'

import { liveAgentWorkflowTabBindings } from './agentWorkflowTabBindingStorage'

describe('liveAgentWorkflowTabBindings', () => {
  const now = Date.UTC(2026, 8, 22)
  const binding = {
    tabPath: 'workflows/example.json',
    graphId: 'graph-1'
  }

  it.for([
    {
      label: 'a timestamp beyond the clock-skew tolerance',
      confirmedAt: now + MAX_AGENT_STORAGE_CLOCK_SKEW_MS + 1
    },
    {
      label: 'a non-finite timestamp',
      confirmedAt: Number.POSITIVE_INFINITY
    },
    {
      label: 'an expired timestamp',
      confirmedAt: now - 30 * 24 * 60 * 60 * 1000 - 1
    }
  ])('rejects $label', ({ confirmedAt }) => {
    expect(
      liveAgentWorkflowTabBindings(
        { workflow: { ...binding, confirmedAt } },
        now
      )
    ).toEqual({})
  })

  it('keeps a finite timestamp within the retention window', () => {
    const record = { ...binding, confirmedAt: now }

    expect(liveAgentWorkflowTabBindings({ workflow: record }, now)).toEqual({
      workflow: record
    })
  })

  it('keeps a fresh binding after a small backward clock adjustment', () => {
    const record = { ...binding, confirmedAt: now }

    expect(
      liveAgentWorkflowTabBindings({ workflow: record }, now - 60_000)
    ).toEqual({ workflow: record })
  })
})
