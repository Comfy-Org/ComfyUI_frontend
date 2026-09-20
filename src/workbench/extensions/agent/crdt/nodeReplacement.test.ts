import { describe, expect, it } from 'vitest'

import type {
  ReplacementEffect,
  ReplacementEvent,
  ReplacementState
} from './nodeReplacement'
import {
  initialReplacementState,
  isTerminal,
  transition
} from './nodeReplacement'

const addCause = new Error('add failed')
const configureCause = new Error('configure failed')
const cleanupCause = new Error('cleanup failed')
const restoreCause = new Error('restore failed')

const states = {
  pending: { phase: 'pending' },
  released: { phase: 'released' },
  committed: { phase: 'committed' },
  settled: { phase: 'settled' },
  removing: { phase: 'removing', cause: addCause },
  restoring: { phase: 'restoring' },
  restored: { phase: 'restored' },
  stranded: { phase: 'stranded' }
} as const satisfies Record<ReplacementState['phase'], ReplacementState>

const events = {
  release: { type: 'release' },
  'add-succeeded': { type: 'add-succeeded' },
  'add-failed': { type: 'add-failed', cause: addCause },
  'configure-succeeded': { type: 'configure-succeeded' },
  'configure-failed': { type: 'configure-failed', cause: configureCause },
  'cleanup-succeeded': { type: 'cleanup-succeeded' },
  'cleanup-failed': { type: 'cleanup-failed', cause: cleanupCause },
  'restore-succeeded': { type: 'restore-succeeded' },
  'restore-failed': { type: 'restore-failed', cause: restoreCause }
} as const satisfies Record<ReplacementEvent['type'], ReplacementEvent>

const phases = Object.values(states).map(({ phase }) => phase)
const eventTypes = Object.values(events).map(({ type }) => type)

const legal: ReadonlyArray<{
  from: ReplacementState['phase']
  on: ReplacementEvent['type']
  to: ReplacementState['phase']
  effects: ReplacementEffect[]
}> = [
  {
    from: 'pending',
    on: 'release',
    to: 'released',
    effects: [{ kind: 'release-records' }, { kind: 'add-successor' }]
  },
  {
    from: 'released',
    on: 'add-succeeded',
    to: 'committed',
    effects: [{ kind: 'configure-successor' }]
  },
  {
    from: 'released',
    on: 'add-failed',
    to: 'removing',
    effects: [{ kind: 'remove-successor' }]
  },
  { from: 'committed', on: 'configure-succeeded', to: 'settled', effects: [] },
  {
    from: 'committed',
    on: 'configure-failed',
    to: 'settled',
    effects: [
      {
        kind: 'report',
        errorType: 'agent_node_materialize_configure_failed',
        cause: configureCause
      }
    ]
  },
  {
    from: 'removing',
    on: 'cleanup-succeeded',
    to: 'restoring',
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
    from: 'removing',
    on: 'cleanup-failed',
    to: 'restoring',
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
  },
  { from: 'restoring', on: 'restore-succeeded', to: 'restored', effects: [] },
  {
    from: 'restoring',
    on: 'restore-failed',
    to: 'stranded',
    effects: [
      {
        kind: 'report',
        errorType: 'agent_node_materialize_restore_failed',
        cause: restoreCause
      }
    ]
  }
]

function isLegal(
  from: ReplacementState['phase'],
  on: ReplacementEvent['type']
): boolean {
  return legal.some((row) => row.from === from && row.on === on)
}

function reportCauses(effects: ReplacementEffect[]): unknown[] {
  return effects.flatMap((effect) =>
    effect.kind === 'report' ? [effect.cause] : []
  )
}

describe('nodeReplacement transition table', () => {
  it('starts pending', () => {
    expect(initialReplacementState()).toEqual({ phase: 'pending' })
  })

  it.for(legal)('$from + $on -> $to', ({ from, on, to, effects }) => {
    const result = transition(states[from], events[on])
    expect(result.state.phase).toBe(to)
    expect(result.effects).toEqual(effects)
  })

  it('covers every (state, event) pair exactly once', () => {
    let pairs = 0
    for (const phase of phases) {
      for (const type of eventTypes) {
        pairs += 1
        const state = states[phase]
        const result = transition(state, events[type])
        if (isLegal(phase, type)) {
          expect(result.state).not.toBe(state)
        } else {
          expect(result.state).toBe(state)
          expect(result.effects).toEqual([])
        }
      }
    }
    expect(pairs).toBe(8 * 9)
    expect(legal).toHaveLength(9)
  })

  it('only settled, restored and stranded are terminal', () => {
    const terminal = phases.filter((phase) => isTerminal(states[phase]))
    expect(terminal.sort()).toEqual(['restored', 'settled', 'stranded'])
  })

  it('terminal states ignore every event', () => {
    for (const phase of ['settled', 'restored', 'stranded'] as const) {
      for (const type of eventTypes) {
        const state = states[phase]
        expect(transition(state, events[type])).toEqual({
          state,
          effects: []
        })
      }
    }
  })
})

describe('nodeReplacement failure causes', () => {
  it('carries the add cause into removing by identity', () => {
    const result = transition(states.released, events['add-failed'])
    expect(result.state.phase).toBe('removing')
    if (result.state.phase !== 'removing') throw new Error('unreachable')
    expect(result.state.cause).toBe(addCause)
  })

  it('reports the original add cause after cleanup, not the cleanup cause', () => {
    const removing = transition(states.released, events['add-failed']).state
    const succeeded = transition(removing, events['cleanup-succeeded'])
    expect(reportCauses(succeeded.effects)).toEqual([addCause])
    expect(reportCauses(succeeded.effects)[0]).toBe(addCause)

    const failed = transition(removing, events['cleanup-failed'])
    const causes = reportCauses(failed.effects)
    expect(causes).toHaveLength(2)
    expect(causes[0]).toBe(addCause)
    expect(causes[1]).toBe(cleanupCause)
  })

  it('reports the configure cause by identity and still settles', () => {
    const result = transition(states.committed, events['configure-failed'])
    expect(result.state.phase).toBe('settled')
    expect(reportCauses(result.effects)[0]).toBe(configureCause)
  })

  it('reports the restore cause by identity and strands', () => {
    const result = transition(states.restoring, events['restore-failed'])
    expect(result.state.phase).toBe('stranded')
    expect(reportCauses(result.effects)[0]).toBe(restoreCause)
  })
})

describe('nodeReplacement scripted paths', () => {
  function run(script: ReplacementEvent[]) {
    let state = initialReplacementState()
    const effects: ReplacementEffect[] = []
    for (const event of script) {
      const result = transition(state, event)
      state = result.state
      effects.push(...result.effects)
    }
    return { state, effects }
  }

  it('happy path: release, add, configure', () => {
    const { state, effects } = run([
      events.release,
      events['add-succeeded'],
      events['configure-succeeded']
    ])
    expect(state).toEqual({ phase: 'settled' })
    expect(effects.map((effect) => effect.kind)).toEqual([
      'release-records',
      'add-successor',
      'configure-successor'
    ])
  })

  it('configure failure commits anyway and reports once', () => {
    const { state, effects } = run([
      events.release,
      events['add-succeeded'],
      events['configure-failed']
    ])
    expect(state).toEqual({ phase: 'settled' })
    expect(effects.filter((effect) => effect.kind === 'report')).toEqual([
      {
        kind: 'report',
        errorType: 'agent_node_materialize_configure_failed',
        cause: configureCause
      }
    ])
    expect(effects.some((effect) => effect.kind === 'restore-records')).toBe(
      false
    )
  })

  it('add failure removes, restores, then reports the add failure', () => {
    const { state, effects } = run([
      events.release,
      events['add-failed'],
      events['cleanup-succeeded'],
      events['restore-succeeded']
    ])
    expect(state).toEqual({ phase: 'restored' })
    expect(effects.map((effect) => effect.kind)).toEqual([
      'release-records',
      'add-successor',
      'remove-successor',
      'restore-records',
      'report'
    ])
  })

  it('cleanup failure still restores and reports both causes', () => {
    const { state, effects } = run([
      events.release,
      events['add-failed'],
      events['cleanup-failed'],
      events['restore-succeeded']
    ])
    expect(state).toEqual({ phase: 'restored' })
    expect(effects.filter((effect) => effect.kind === 'report')).toEqual([
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
    ])
  })

  it('restore failure strands the replacement and reports it', () => {
    const { state, effects } = run([
      events.release,
      events['add-failed'],
      events['cleanup-succeeded'],
      events['restore-failed']
    ])
    expect(state).toEqual({ phase: 'stranded' })
    expect(
      effects.filter((effect) => effect.kind === 'report').map((e) => e.kind)
    ).toHaveLength(2)
    expect(effects.at(-1)).toEqual({
      kind: 'report',
      errorType: 'agent_node_materialize_restore_failed',
      cause: restoreCause
    })
  })

  it('is not restored until the driver reports the restore result', () => {
    const { state } = run([
      events.release,
      events['add-failed'],
      events['cleanup-succeeded']
    ])
    expect(state).toEqual({ phase: 'restoring' })
    expect(isTerminal(state)).toBe(false)
  })

  it('duplicate and stale events are ignored without effects', () => {
    const { state, effects } = run([
      events.release,
      events.release,
      events['add-succeeded'],
      events['add-succeeded'],
      events['configure-succeeded'],
      events['add-failed'],
      events['restore-failed']
    ])
    expect(state).toEqual({ phase: 'settled' })
    expect(effects.map((effect) => effect.kind)).toEqual([
      'release-records',
      'add-successor',
      'configure-successor'
    ])
  })
})
