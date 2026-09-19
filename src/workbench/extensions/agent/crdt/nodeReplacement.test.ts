import { describe, expect, it } from 'vitest'

import type {
  ReplacementEffect,
  ReplacementEvent,
  ReplacementState
} from './nodeReplacement'
import {
  IllegalReplacementTransition,
  initialReplacementState,
  isTerminal,
  transition
} from './nodeReplacement'

const addCause = new Error('onAdded threw')
const configureCause = new Error('configure threw')
const cleanupCause = new Error('onRemoved threw')

const states: Record<ReplacementState['phase'], ReplacementState> = {
  pending: { phase: 'pending' },
  released: { phase: 'released' },
  committed: { phase: 'committed' },
  settled: { phase: 'settled' },
  restoring: { phase: 'restoring', cause: addCause },
  restored: { phase: 'restored', cause: addCause }
}

const events: Record<ReplacementEvent['type'], ReplacementEvent> = {
  release: { type: 'release' },
  'add-succeeded': { type: 'add-succeeded' },
  'add-failed': { type: 'add-failed', cause: addCause },
  'configure-succeeded': { type: 'configure-succeeded' },
  'configure-failed': { type: 'configure-failed', cause: configureCause },
  'cleanup-succeeded': { type: 'cleanup-succeeded' },
  'cleanup-failed': { type: 'cleanup-failed', cause: cleanupCause }
}

/**
 * Every legal (state, event) pair. Any pair absent from this table must throw;
 * the exhaustiveness test below enumerates the full cross product so a new
 * state or event cannot be added without deciding its row here.
 */
const legal: {
  from: ReplacementState['phase']
  on: ReplacementEvent['type']
  to: ReplacementState
  effects: ReplacementEffect[]
}[] = [
  {
    from: 'pending',
    on: 'release',
    to: { phase: 'released' },
    effects: [{ kind: 'release-records' }, { kind: 'add-successor' }]
  },
  {
    from: 'released',
    on: 'add-succeeded',
    to: { phase: 'committed' },
    effects: [{ kind: 'configure-successor' }]
  },
  {
    from: 'released',
    on: 'add-failed',
    to: { phase: 'restoring', cause: addCause },
    effects: [{ kind: 'remove-successor' }]
  },
  {
    from: 'committed',
    on: 'configure-succeeded',
    to: { phase: 'settled' },
    effects: []
  },
  {
    // Commit point is `add` success: a configure failure is an effect to
    // report, not a reason to restore (the node stays attached).
    from: 'committed',
    on: 'configure-failed',
    to: { phase: 'settled', configureFailure: configureCause },
    effects: [
      {
        kind: 'report',
        errorType: 'agent_node_materialize_configure_failed',
        cause: configureCause
      }
    ]
  },
  {
    // Restoring the authoritative records is unconditional; cleanup of the
    // half-added successor is best-effort and reported separately.
    from: 'restoring',
    on: 'cleanup-succeeded',
    to: { phase: 'restored', cause: addCause },
    effects: [
      { kind: 'restore-records' },
      {
        kind: 'report',
        errorType: 'agent_node_materialize_add_failed',
        cause: addCause
      }
    ]
  },
  {
    from: 'restoring',
    on: 'cleanup-failed',
    to: { phase: 'restored', cause: addCause, cleanupFailure: cleanupCause },
    effects: [
      { kind: 'restore-records' },
      {
        kind: 'report',
        errorType: 'agent_node_materialize_add_failed',
        cause: addCause
      },
      {
        kind: 'report',
        errorType: 'agent_node_materialize_rollback_failed',
        cause: cleanupCause
      }
    ]
  }
]

describe('nodeReplacement transition table', () => {
  it('starts pending and not terminal', () => {
    const start = initialReplacementState()
    expect(start).toEqual({ phase: 'pending' })
    expect(isTerminal(start)).toBe(false)
  })

  it.for(legal)('$from --$on--> $to.phase', ({ from, on, to, effects }) => {
    expect(transition(states[from], events[on])).toEqual({
      state: to,
      effects
    })
  })

  it('rejects every pair not in the table, and only those', () => {
    const legalKeys = new Set(legal.map(({ from, on }) => `${from}/${on}`))
    const phases = Object.keys(states) as ReplacementState['phase'][]
    const types = Object.keys(events) as ReplacementEvent['type'][]
    expect(phases.length * types.length).toBe(42)

    const rejected: string[] = []
    for (const phase of phases) {
      for (const type of types) {
        const key = `${phase}/${type}`
        if (legalKeys.has(key)) continue
        expect(() => transition(states[phase], events[type])).toThrow(
          IllegalReplacementTransition
        )
        rejected.push(key)
      }
    }
    expect(rejected.length).toBe(42 - legal.length)
  })

  it('treats exactly settled and restored as terminal', () => {
    const terminal = Object.values(states).filter(isTerminal)
    expect(terminal.map((state) => state.phase).sort()).toEqual([
      'restored',
      'settled'
    ])
  })

  it('names the cause in the illegal-transition error', () => {
    expect(() => transition({ phase: 'settled' }, { type: 'release' })).toThrow(
      /settled.*release/
    )
  })
})

/** Fold a scripted event sequence, collecting effects in order. */
function run(script: ReplacementEvent[]) {
  let state = initialReplacementState()
  const effects: ReplacementEffect[] = []
  for (const event of script) {
    const next = transition(state, event)
    state = next.state
    effects.push(...next.effects)
  }
  return { state, effects: effects.map(describeEffect) }
}

function describeEffect(effect: ReplacementEffect): string {
  return effect.kind === 'report' ? `report:${effect.errorType}` : effect.kind
}

describe('nodeReplacement scripted paths', () => {
  it('happy path: release, add, configure', () => {
    expect(
      run([
        events.release,
        events['add-succeeded'],
        events['configure-succeeded']
      ])
    ).toEqual({
      state: { phase: 'settled' },
      effects: ['release-records', 'add-successor', 'configure-successor']
    })
  })

  it('configure failure after commit keeps the successor and reports once', () => {
    const result = run([
      events.release,
      events['add-succeeded'],
      events['configure-failed']
    ])
    expect(result.state).toEqual({
      phase: 'settled',
      configureFailure: configureCause
    })
    expect(result.effects).toEqual([
      'release-records',
      'add-successor',
      'configure-successor',
      'report:agent_node_materialize_configure_failed'
    ])
    expect(result.effects).not.toContain('restore-records')
  })

  it('add failure removes the successor before restoring records', () => {
    const result = run([
      events.release,
      events['add-failed'],
      events['cleanup-succeeded']
    ])
    expect(result.state).toEqual({ phase: 'restored', cause: addCause })
    expect(result.effects).toEqual([
      'release-records',
      'add-successor',
      'remove-successor',
      'restore-records',
      'report:agent_node_materialize_add_failed'
    ])
  })

  it('cleanup failure still restores records and reports both failures', () => {
    const result = run([
      events.release,
      events['add-failed'],
      events['cleanup-failed']
    ])
    expect(result.state).toEqual({
      phase: 'restored',
      cause: addCause,
      cleanupFailure: cleanupCause
    })
    expect(result.effects.slice(2)).toEqual([
      'remove-successor',
      'restore-records',
      'report:agent_node_materialize_add_failed',
      'report:agent_node_materialize_rollback_failed'
    ])
  })
})
