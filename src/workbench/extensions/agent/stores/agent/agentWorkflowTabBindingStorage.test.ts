import { describe, expect, it } from 'vitest'

import { liveAgentWorkflowTabBindings } from './agentWorkflowTabBindingStorage'

describe('liveAgentWorkflowTabBindings', () => {
  const now = Date.UTC(2026, 8, 22)
  const binding = {
    tabPath: 'workflows/example.json',
    graphId: 'graph-1'
  }

  it.each([
    ['a future timestamp', now + 1],
    ['a non-finite timestamp', Number.POSITIVE_INFINITY],
    ['an expired timestamp', now - 30 * 24 * 60 * 60 * 1000 - 1]
  ])('rejects %s', (_label, confirmedAt) => {
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
})
