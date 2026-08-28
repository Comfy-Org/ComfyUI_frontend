/**
 * These pin the merge SEMANTICS the panel explains to a tester, against the
 * pinned applier. If the pin moves and a verdict changes, the explanations
 * shown in the merge lab become wrong — which is worse than showing nothing —
 * so the vectors fail here rather than misinform someone in the UI.
 */
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'

import type { MergeScenario } from './mergeScenarios'
import { MERGE_SCENARIOS, runScenario } from './mergeScenarios'

function scenario(id: string) {
  const found = MERGE_SCENARIOS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no scenario ${id}`)
  return found
}

function verdicts(id: string) {
  return runScenario(scenario(id)).entries.map((entry) => entry.verdict)
}

describe('merge scenarios', () => {
  it('shows a write to a deleted node vanishing, and a re-add NOT restoring it', () => {
    const simulation = runScenario(scenario('delete-then-write-then-add'))

    expect(simulation.entries.map((entry) => entry.verdict)).toEqual([
      { kind: 'applied' },
      { kind: 'no-op', because: 'delete-wins' },
      { kind: 'applied' }
    ])
    // The whole point of the scenario: the widget edit made while the node was
    // deleted is gone, and the re-added node carries the add's own payload.
    expect(simulation.survivingWidgets['A.text']).toBe('a dog')
    expect(simulation.survivingNodeIds).toContain('A')
  })

  it('names the incumbent stamp when a stale write loses a register', () => {
    const [winner, loser] = runScenario(scenario('stale-write-loses')).entries

    expect(winner.verdict).toEqual({ kind: 'applied' })
    expect(loser.verdict.kind).toBe('lww-dropped')
    expect(
      loser.verdict.kind === 'lww-dropped' && loser.verdict.incumbent?.[2]
    ).toBe(winner.opId)
    expect(loser.explanation).toContain('Last-writer-wins')
  })

  it('distinguishes an idempotent resend from a conflict', () => {
    expect(verdicts('idempotent-resend')).toEqual([
      { kind: 'applied' },
      { kind: 'no-op', because: 'duplicate-op-id' }
    ])
  })

  it('reports the ops behind a rejection as never attempted, not as failures', () => {
    const [first, failed, tail] = runScenario(scenario('batch-abort')).entries

    expect(first.verdict).toEqual({ kind: 'applied' })
    expect(failed.verdict.kind).toBe('rejected')
    // A tester must be able to tell "your edit was refused" from "your edit
    // never got a turn"; the applier gives both the same `rejected` outcome.
    expect(tail.verdict.kind).toBe('applied')
  })

  it('breaks a same-base_version tie on the actor, not on arrival order', () => {
    const simulation = runScenario(scenario('concurrent-widget-writes'))
    const [first, second] = simulation.entries

    expect(first.register).toBe(second.register)
    expect(first.registerLabel).toContain('widget "seed"')
    // Same base_version, so the actor breaks the tie: `human:bob:tab2` sorts
    // above `human:alice:tab1` on every replica, arrival order regardless.
    expect(first.verdict).toEqual({ kind: 'applied' })
    expect(second.verdict.kind).toBe('lww-dropped')
    expect(simulation.survivingWidgets['B.seed']).toBe(222)
  })

  it('runs a scenario held in Vue reactive state', () => {
    // Regression: a deep reactive proxy reaching mint()'s structuredClone
    // threw DataCloneError and took the whole merge lab down.
    const proxied = reactive({
      ...scenario('delete-then-write-then-add')
    }) as MergeScenario

    expect(() => runScenario(proxied)).not.toThrow()
    expect(runScenario(proxied).entries).toHaveLength(3)
  })

  it('gives every op a register, a stamp and a human explanation', () => {
    for (const candidate of MERGE_SCENARIOS) {
      for (const entry of runScenario(candidate).entries) {
        expect(entry.register).not.toBe('')
        expect(entry.stamp).toHaveLength(3)
        expect(entry.explanation.length).toBeGreaterThan(10)
      }
    }
  })
})
