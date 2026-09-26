import { describe, expect, it } from 'vitest'

import type {
  ReplacementCommand,
  ReplacementEvent,
  ReplacementState,
  ReplacementStep
} from './nodeReplacement'
import {
  initialReplacementState,
  isTerminal,
  stepEvent,
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
  commands: readonly ReplacementCommand[]
  step: ReplacementStep | null
}> = [
  {
    from: 'pending',
    on: 'release',
    to: 'released',
    commands: [{ kind: 'release-records' }],
    step: 'add-successor'
  },
  {
    from: 'released',
    on: 'add-succeeded',
    to: 'committed',
    commands: [],
    step: 'configure-successor'
  },
  {
    from: 'released',
    on: 'add-failed',
    to: 'removing',
    commands: [],
    step: 'remove-successor'
  },
  {
    from: 'committed',
    on: 'configure-succeeded',
    to: 'settled',
    commands: [],
    step: null
  },
  {
    from: 'committed',
    on: 'configure-failed',
    to: 'settled',
    commands: [
      {
        kind: 'report',
        errorType: 'agent_node_materialize_configure_failed',
        outcome: 'degraded',
        cause: configureCause
      }
    ],
    step: null
  },
  {
    from: 'removing',
    on: 'cleanup-succeeded',
    to: 'restoring',
    commands: [
      {
        kind: 'report',
        errorType: 'agent_node_materialize_add_failed',
        outcome: 'recovered',
        cause: addCause
      }
    ],
    step: 'restore-records'
  },
  {
    from: 'removing',
    on: 'cleanup-failed',
    to: 'restoring',
    commands: [
      {
        kind: 'report',
        errorType: 'agent_node_materialize_add_failed',
        outcome: 'degraded',
        cause: addCause
      },
      {
        kind: 'report',
        errorType: 'agent_node_materialize_rollback_failed',
        outcome: 'degraded',
        cause: cleanupCause
      }
    ],
    step: 'restore-records'
  },
  {
    from: 'restoring',
    on: 'restore-succeeded',
    to: 'restored',
    commands: [],
    step: null
  },
  {
    from: 'restoring',
    on: 'restore-failed',
    to: 'stranded',
    commands: [
      {
        kind: 'report',
        errorType: 'agent_node_materialize_restore_failed',
        outcome: 'degraded',
        cause: restoreCause
      }
    ],
    step: null
  }
]

function isLegal(
  from: ReplacementState['phase'],
  on: ReplacementEvent['type']
): boolean {
  return legal.some((row) => row.from === from && row.on === on)
}

function reportCauses(commands: readonly ReplacementCommand[]): unknown[] {
  return commands.flatMap((command) =>
    command.kind === 'report' ? [command.cause] : []
  )
}

describe('nodeReplacement transition table', () => {
  it('starts pending', () => {
    expect(initialReplacementState()).toEqual({ phase: 'pending' })
  })

  it.for(legal)('$from + $on -> $to', ({ from, on, to, commands, step }) => {
    const result = transition(states[from], events[on])
    expect(result.state.phase).toBe(to)
    expect(result.commands).toEqual(commands)
    expect(result.step).toBe(step)
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
          expect(result.commands).toEqual([])
          expect(result.step).toBeNull()
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
          commands: [],
          step: null
        })
      }
    }
  })
})

describe('nodeReplacement driver contract', () => {
  it('every non-terminal target waits on exactly one step; terminal targets on none', () => {
    for (const { from, on } of legal) {
      const { state, step } = transition(states[from], events[on])
      if (isTerminal(state)) expect(step).toBeNull()
      else expect(step).not.toBeNull()
    }
  })

  it('commands never include a fallible effect', () => {
    for (const { from, on } of legal) {
      const { commands } = transition(states[from], events[on])
      for (const command of commands) {
        expect(['release-records', 'report']).toContain(command.kind)
      }
    }
  })

  it.for([
    ['add-successor', 'add-succeeded', 'add-failed'],
    ['configure-successor', 'configure-succeeded', 'configure-failed'],
    ['remove-successor', 'cleanup-succeeded', 'cleanup-failed'],
    ['restore-records', 'restore-succeeded', 'restore-failed']
  ] as const)('%s -> %s | %s', ([step, ok, failed]) => {
    expect(stepEvent(step, { ok: true })).toEqual({ type: ok })
    const cause = new Error(step)
    const event = stepEvent(step, { ok: false, cause })
    expect(event.type).toBe(failed)
    if (!('cause' in event)) throw new Error('unreachable')
    expect(event.cause).toBe(cause)
  })

  it('a step failure event is accepted by the state that issued the step', () => {
    for (const { from, on } of legal) {
      const { state, step } = transition(states[from], events[on])
      if (step === null) continue
      const cause = new Error(step)
      const next = transition(state, stepEvent(step, { ok: false, cause }))
      expect(next.state).not.toBe(state)
      const ok = transition(state, stepEvent(step, { ok: true }))
      expect(ok.state).not.toBe(state)
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
    expect(reportCauses(succeeded.commands)).toEqual([addCause])
    expect(reportCauses(succeeded.commands)[0]).toBe(addCause)

    const failed = transition(removing, events['cleanup-failed'])
    const causes = reportCauses(failed.commands)
    expect(causes).toHaveLength(2)
    expect(causes[0]).toBe(addCause)
    expect(causes[1]).toBe(cleanupCause)
  })

  it('tags the add failure recovered or degraded by cleanup arm, not by lookahead', () => {
    const removing = transition(states.released, events['add-failed']).state
    const [afterCleanup] = transition(
      removing,
      events['cleanup-succeeded']
    ).commands
    const [afterFailedCleanup] = transition(
      removing,
      events['cleanup-failed']
    ).commands
    expect(afterCleanup).toEqual({
      kind: 'report',
      errorType: 'agent_node_materialize_add_failed',
      outcome: 'recovered',
      cause: addCause
    })
    expect(afterFailedCleanup).toEqual({
      kind: 'report',
      errorType: 'agent_node_materialize_add_failed',
      outcome: 'degraded',
      cause: addCause
    })
  })

  it('reports the configure cause by identity and still settles', () => {
    const result = transition(states.committed, events['configure-failed'])
    expect(result.state.phase).toBe('settled')
    expect(reportCauses(result.commands)[0]).toBe(configureCause)
  })

  it('reports the restore cause by identity and strands', () => {
    const result = transition(states.restoring, events['restore-failed'])
    expect(result.state.phase).toBe('stranded')
    expect(reportCauses(result.commands)[0]).toBe(restoreCause)
  })
})

describe('nodeReplacement scripted paths', () => {
  /**
   * The reference driver: run commands, run the step, feed its result back.
   * `outcomes` decides each step; a missing entry means success.
   */
  function drive(outcomes: Partial<Record<ReplacementStep, unknown>>) {
    let state = initialReplacementState()
    const trace: string[] = []
    let result = transition(state, events.release)
    for (;;) {
      state = result.state
      for (const command of result.commands) {
        trace.push(
          command.kind === 'report'
            ? `report:${command.errorType}:${command.outcome}`
            : command.kind
        )
      }
      if (result.step === null) break
      trace.push(result.step)
      const outcome =
        result.step in outcomes
          ? { ok: false as const, cause: outcomes[result.step] }
          : { ok: true as const }
      result = transition(state, stepEvent(result.step, outcome))
    }
    return { state, trace }
  }

  it('happy path: release, add, configure', () => {
    const { state, trace } = drive({})
    expect(state).toEqual({ phase: 'settled' })
    expect(trace).toEqual([
      'release-records',
      'add-successor',
      'configure-successor'
    ])
  })

  it('configure failure commits anyway and reports once', () => {
    const { state, trace } = drive({ 'configure-successor': configureCause })
    expect(state).toEqual({ phase: 'settled' })
    expect(trace).toEqual([
      'release-records',
      'add-successor',
      'configure-successor',
      'report:agent_node_materialize_configure_failed:degraded'
    ])
  })

  it('add failure removes, reports, then restores', () => {
    const { state, trace } = drive({ 'add-successor': addCause })
    expect(state).toEqual({ phase: 'restored' })
    expect(trace).toEqual([
      'release-records',
      'add-successor',
      'remove-successor',
      'report:agent_node_materialize_add_failed:recovered',
      'restore-records'
    ])
  })

  it('cleanup failure still restores and reports both causes first', () => {
    const { state, trace } = drive({
      'add-successor': addCause,
      'remove-successor': cleanupCause
    })
    expect(state).toEqual({ phase: 'restored' })
    expect(trace).toEqual([
      'release-records',
      'add-successor',
      'remove-successor',
      'report:agent_node_materialize_add_failed:degraded',
      'report:agent_node_materialize_rollback_failed:degraded',
      'restore-records'
    ])
  })

  it('restore failure strands, and the earlier reports were already emitted', () => {
    const { state, trace } = drive({
      'add-successor': addCause,
      'remove-successor': cleanupCause,
      'restore-records': restoreCause
    })
    expect(state).toEqual({ phase: 'stranded' })
    expect(trace).toEqual([
      'release-records',
      'add-successor',
      'remove-successor',
      'report:agent_node_materialize_add_failed:degraded',
      'report:agent_node_materialize_rollback_failed:degraded',
      'restore-records',
      'report:agent_node_materialize_restore_failed:degraded'
    ])
  })

  it('is not restored until the driver reports the restore result', () => {
    let state = initialReplacementState()
    for (const event of [
      events.release,
      events['add-failed'],
      events['cleanup-succeeded']
    ]) {
      state = transition(state, event).state
    }
    expect(state).toEqual({ phase: 'restoring' })
    expect(isTerminal(state)).toBe(false)
  })

  it('duplicate and stale events are ignored without commands or steps', () => {
    let state = initialReplacementState()
    const ignored: ReplacementEvent[] = [
      events.release,
      events['add-succeeded'],
      events['add-failed'],
      events['restore-failed']
    ]
    state = transition(state, events.release).state
    state = transition(state, events['add-succeeded']).state
    state = transition(state, events['configure-succeeded']).state
    expect(state).toEqual({ phase: 'settled' })
    for (const event of ignored) {
      expect(transition(state, event)).toEqual({
        state,
        commands: [],
        step: null
      })
    }
  })
})
