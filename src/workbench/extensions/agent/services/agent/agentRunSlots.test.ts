import { describe, expect, it } from 'vitest'

import type { MessagePart, ToolPart } from './agentMessageParts'
import type { RunCardView, RunSlot } from './agentRunSlots'
import {
  isRunInFlight,
  runCardView,
  runOwnedCallIds,
  runSlotsOf
} from './agentRunSlots'

function tool(
  callId: string,
  name: string,
  outcome: 'running' | 'ok' | 'error',
  durationMs?: number
): ToolPart {
  return {
    type: 'tool',
    callId,
    name,
    state: outcome === 'running' ? 'streaming' : 'done',
    ...(outcome === 'running' ? {} : { ok: outcome === 'ok' }),
    ...(durationMs === undefined ? {} : { durationMs })
  }
}

function slot(overrides: Partial<RunSlot> = {}): RunSlot {
  return {
    callId: 'run-1',
    run: 'ok',
    wait: 'absent',
    output: 'absent',
    awaitingApproval: false,
    turnLive: true,
    ...overrides
  }
}

describe('runSlotsOf', () => {
  it('folds a run with its wait and output calls into one slot', () => {
    const parts: MessagePart[] = [
      tool('run-1', 'run', 'ok', 300),
      tool('wait-1', 'wait_for_job', 'ok', 40_000),
      tool('out-1', 'get_output', 'ok', 700)
    ]

    expect(runSlotsOf({ parts, streaming: false })).toEqual([
      {
        callId: 'run-1',
        run: 'ok',
        wait: 'ok',
        output: 'ok',
        toolDurationMs: 41_000,
        awaitingApproval: false,
        turnLive: false
      }
    ])
  })

  it('reports a run on its own as having no wait and no output', () => {
    const parts: MessagePart[] = [tool('run-1', 'run', 'running')]

    expect(runSlotsOf({ parts, streaming: true })).toEqual([
      {
        callId: 'run-1',
        run: 'running',
        wait: 'absent',
        output: 'absent',
        awaitingApproval: false,
        turnLive: true
      }
    ])
  })

  it.for<[string, ToolPart[], RunSlot['wait']]>([
    [
      'running while any call is still running',
      [
        tool('wait-1', 'wait_for_job', 'error'),
        tool('wait-2', 'wait_for_job', 'running')
      ],
      'running'
    ],
    [
      'errored once any settled call failed',
      [
        tool('wait-1', 'wait_for_job', 'error'),
        tool('wait-2', 'wait_for_job', 'ok')
      ],
      'error'
    ],
    [
      'ok when every call succeeded',
      [
        tool('wait-1', 'wait_for_job', 'ok'),
        tool('wait-2', 'wait_for_job', 'ok')
      ],
      'ok'
    ]
  ])('folds several waits as %s', ([, waits, wait]) => {
    const parts: MessagePart[] = [tool('run-1', 'run', 'ok'), ...waits]

    expect(runSlotsOf({ parts, streaming: true })).toMatchObject([{ wait }])
  })

  it('sums only the durations that are known', () => {
    const parts: MessagePart[] = [
      tool('run-1', 'run', 'ok', 500),
      tool('wait-1', 'wait_for_job', 'ok'),
      tool('wait-2', 'wait_for_job', 'ok', 2_500)
    ]

    expect(runSlotsOf({ parts, streaming: false })).toMatchObject([
      { toolDurationMs: 3_000 }
    ])
  })

  it('keeps several runs in one message apart, in order', () => {
    const parts: MessagePart[] = [
      tool('run-1', 'run', 'ok', 100),
      tool('wait-1', 'wait_for_job', 'error', 900),
      { type: 'text', text: 'Trying again.', state: 'done' },
      tool('fix-1', 'set_widget', 'ok', 50),
      tool('run-2', 'run', 'ok', 200),
      tool('wait-2', 'wait_for_job', 'running')
    ]

    expect(runSlotsOf({ parts, streaming: true })).toEqual([
      {
        callId: 'run-1',
        run: 'ok',
        wait: 'error',
        output: 'absent',
        toolDurationMs: 1_000,
        awaitingApproval: false,
        turnLive: true
      },
      {
        callId: 'run-2',
        run: 'ok',
        wait: 'running',
        output: 'absent',
        toolDurationMs: 200,
        awaitingApproval: false,
        turnLive: true
      }
    ])
  })

  it('makes no slot for a wait or output that no run precedes', () => {
    const parts: MessagePart[] = [
      tool('wait-0', 'wait_for_job', 'ok'),
      tool('out-0', 'get_output', 'ok')
    ]

    expect(runSlotsOf({ parts, streaming: false })).toEqual([])
  })

  it('marks a run that has not returned as awaiting a pending approval', () => {
    const parts: MessagePart[] = [
      tool('run-1', 'run', 'ok'),
      tool('wait-1', 'wait_for_job', 'ok'),
      tool('run-2', 'run', 'running'),
      { type: 'runApproval', askId: 'ask-2' }
    ]

    expect(
      runSlotsOf({ parts, streaming: true }).map(
        ({ callId, awaitingApproval }) => [callId, awaitingApproval]
      )
    ).toEqual([
      ['run-1', false],
      ['run-2', true]
    ])
  })
})

describe('runOwnedCallIds', () => {
  it('owns each run with the waits and outputs that follow it', () => {
    const parts: MessagePart[] = [
      tool('load-1', 'load_skill', 'ok'),
      tool('run-1', 'run', 'ok'),
      tool('wait-1', 'wait_for_job', 'ok'),
      tool('wait-2', 'wait_for_job', 'ok'),
      tool('out-1', 'get_output', 'ok'),
      tool('fix-1', 'set_widget', 'ok'),
      tool('run-2', 'run', 'running')
    ]

    expect([...runOwnedCallIds(parts)]).toEqual([
      'run-1',
      'wait-1',
      'wait-2',
      'out-1',
      'run-2'
    ])
  })

  it('leaves a wait or output with no earlier run unowned', () => {
    const parts: MessagePart[] = [
      tool('wait-0', 'wait_for_job', 'ok'),
      tool('out-0', 'get_output', 'ok'),
      tool('run-1', 'run', 'ok'),
      tool('wait-1', 'wait_for_job', 'ok')
    ]

    expect([...runOwnedCallIds(parts)]).toEqual(['run-1', 'wait-1'])
  })
})

describe('runCardView', () => {
  it.for<[string, Partial<RunSlot>, RunCardView]>([
    [
      'a run waiting on approval',
      { run: 'running', awaitingApproval: true },
      'hidden'
    ],
    ['a run call still in flight', { run: 'running' }, 'starting'],
    [
      'a run call the turn ended on',
      { run: 'running', turnLive: false },
      'requested'
    ],
    ['a run call that failed', { run: 'error' }, 'notStarted'],
    [
      'a failed run call after the turn settled',
      { run: 'error', turnLive: false },
      'notStarted'
    ],
    ['a submitted run with no wait yet', { run: 'ok' }, 'running'],
    ['a wait still in flight', { run: 'ok', wait: 'running' }, 'running'],
    [
      'an output call in flight with no wait',
      { run: 'ok', output: 'running' },
      'running'
    ],
    ['a wait that returned', { run: 'ok', wait: 'ok' }, 'ran'],
    ['a wait that failed', { run: 'ok', wait: 'error' }, 'ran'],
    [
      'an output that returned with no wait',
      { run: 'ok', output: 'ok' },
      'ran'
    ],
    [
      'an output that failed with no wait',
      { run: 'ok', output: 'error' },
      'ran'
    ],
    [
      'a returned wait after the turn settled',
      { run: 'ok', wait: 'ok', output: 'ok', turnLive: false },
      'ran'
    ],
    [
      'a turn that settled during the wait',
      { run: 'ok', wait: 'running', turnLive: false },
      'ran'
    ],
    [
      'a turn that settled with no wait at all',
      { run: 'ok', turnLive: false },
      'requested'
    ],
    [
      'a turn that settled on an unfinished output with no wait',
      { run: 'ok', output: 'running', turnLive: false },
      'requested'
    ]
  ])('shows %s as its own view', ([, overrides, view]) => {
    expect(runCardView(slot(overrides))).toBe(view)
  })
})

describe('isRunInFlight', () => {
  it.for<[string, Partial<RunSlot>, boolean]>([
    ['the run call is in flight', { run: 'running' }, true],
    ['the job is being waited on', { run: 'ok', wait: 'running' }, true],
    [
      'approval is still pending',
      { run: 'running', awaitingApproval: true },
      false
    ],
    ['the run call failed', { run: 'error' }, false],
    ['the wait returned', { run: 'ok', wait: 'ok' }, false],
    ['the turn settled', { run: 'ok', wait: 'running', turnLive: false }, false]
  ])('is %s', ([, overrides, inFlight]) => {
    expect(isRunInFlight(slot(overrides))).toBe(inFlight)
  })
})
