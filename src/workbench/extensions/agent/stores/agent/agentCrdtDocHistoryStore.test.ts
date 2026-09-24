import { beforeEach, describe, expect, it } from 'vitest'

import { useAgentCrdtDocHistoryStore } from './agentCrdtDocHistoryStore'

describe('agentCrdtDocHistoryStore', () => {
  beforeEach(() => localStorage.clear())

  it('unions observations from independent browser contexts without a lost update', () => {
    const history = useAgentCrdtDocHistoryStore()
    const firstLineage = history.currentLineage('wf')
    const secondLineage = history.currentLineage('wf')

    history.remember('wf', firstLineage, new Set(['1']))
    history.remember('wf', secondLineage, new Set(['2']))

    expect(history.everSeen('wf', firstLineage)).toEqual(new Set(['1', '2']))
  })

  it('isolates a reset lineage from late writes by a stale browser context', () => {
    const history = useAgentCrdtDocHistoryStore()
    const oldLineage = history.currentLineage('wf')
    const newLineage = history.reset('wf', 42)

    history.remember('wf', oldLineage, new Set(['deleted']))
    history.remember('wf', newLineage, new Set(['current']))

    const reopenedLineage = history.currentLineage('wf')
    expect(reopenedLineage).toBe(newLineage)
    expect(history.everSeen('wf', reopenedLineage)).toEqual(
      new Set(['current'])
    )
  })

  it('does not let a stale reset replace a newer lineage', () => {
    const history = useAgentCrdtDocHistoryStore()

    const currentLineage = history.reset('wf', 43)
    history.reset('wf', 42)

    expect(history.currentLineage('wf')).toBe(currentLineage)
  })

  it('persists observations in localStorage', () => {
    const history = useAgentCrdtDocHistoryStore()
    const lineage = history.currentLineage('wf')
    history.remember('wf', lineage, new Set(['1']))

    expect(history.currentLineage('wf')).toBe(lineage)
    expect(history.everSeen('wf', lineage)).toEqual(new Set(['1']))
  })

  it('scopes observations by workflow', () => {
    const history = useAgentCrdtDocHistoryStore()
    const firstLineage = history.currentLineage('wf-1')
    const secondLineage = history.currentLineage('wf-2')
    history.remember('wf-1', firstLineage, new Set(['1']))
    history.remember('wf-2', secondLineage, new Set(['2']))

    expect(history.everSeen('wf-1', firstLineage)).toEqual(new Set(['1']))
    expect(history.everSeen('wf-2', secondLineage)).toEqual(new Set(['2']))
  })
})
