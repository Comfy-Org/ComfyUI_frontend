import { describe, expect, it } from 'vitest'

import { MERGE_SCENARIOS, runScenario } from './mergeScenarios'
import { groupByRegister, nodeLifecycle, registerLabel } from './mergeTrace'

function scenarioEntries(id: string) {
  const found = MERGE_SCENARIOS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no scenario ${id}`)
  return runScenario(found).entries
}

describe('registerLabel', () => {
  it('names the contested cell in words a tester can act on', () => {
    expect(registerLabel(['widget', '7', 'seed'])).toBe(
      'widget "seed" on node 7'
    )
    expect(registerLabel(['input', '7', 2])).toBe('input slot 2 on node 7')
  })

  it('falls back to the raw target rather than hiding an unknown shape', () => {
    expect(registerLabel(['something_new', 'x'])).toBe('something_new · x')
  })
})

describe('nodeLifecycle', () => {
  it('counts a delete-then-re-add as a NEW incarnation of the same id', () => {
    const rows = nodeLifecycle(scenarioEntries('delete-then-write-then-add'))

    expect(rows.map((row) => [row.entry.kind, row.incarnation])).toEqual([
      ['delete_node', 1],
      ['set_widget', 1],
      ['add_node', 2]
    ])
  })

  it('leaves graph-wide ops out of the per-node story', () => {
    const rows = nodeLifecycle([
      {
        index: 0,
        opId: 'a',
        kind: 'clear',
        actor: 'human:u:t',
        register: '["clear"]',
        registerLabel: 'the whole graph',
        stamp: [1, 'human:u:t', 'a'],
        nodeId: null,
        verdict: { kind: 'applied' },
        explanation: ''
      }
    ])

    expect(rows).toEqual([])
  })
})

describe('groupByRegister', () => {
  it('puts the most-contested register first', () => {
    const groups = groupByRegister(scenarioEntries('concurrent-widget-writes'))

    expect(groups[0].entries).toHaveLength(2)
    expect(groups[0].label).toContain('widget "seed"')
  })
})
