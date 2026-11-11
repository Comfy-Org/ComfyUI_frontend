import { describe, expect, it } from 'vitest'

import type {
  MessagePart,
  TextPart,
  ToolPart
} from '@/workbench/extensions/agent/services/agent/agentMessageParts'

import { groupMessageParts } from './agentMessageGroup'

function tool(
  callId: string,
  name: string,
  state: ToolPart['state'] = 'done'
): ToolPart {
  return {
    type: 'tool',
    callId,
    name,
    state,
    ...(state === 'done' ? { ok: true } : {})
  }
}

function text(value: string): TextPart {
  return { type: 'text', text: value, state: 'done' }
}

function runTurn(): MessagePart[] {
  return [
    { type: 'thinking', text: 'Checking the graph', state: 'done' },
    tool('validate-1', 'validate'),
    text('Running it now.'),
    tool('run-1', 'run'),
    tool('wait-1', 'wait_for_job'),
    tool('out-1', 'get_output'),
    text('Here is the result.')
  ]
}

function kindsOf(groups: ReturnType<typeof groupMessageParts>): string[] {
  return groups.map((group) => group.kind)
}

describe('groupMessageParts', () => {
  it('folds every activity part into one trace where the first one sits', () => {
    const parts: MessagePart[] = [
      text('On it.'),
      tool('ls-1', 'ls_nodes'),
      { type: 'thinking', text: 'Picking a model', state: 'done' },
      tool('set-1', 'set_widget')
    ]

    expect(kindsOf(groupMessageParts(parts))).toEqual(['text', 'trace'])
  })

  it('joins text parts split only by activity and closes them on a user-facing part', () => {
    const parts: MessagePart[] = [
      text('First.'),
      tool('ls-1', 'ls_nodes'),
      text('Second.'),
      { type: 'tabLink', workflowId: 'wf-1' },
      { type: 'tabLink', workflowId: 'wf-2' },
      text('Third.')
    ]

    expect(groupMessageParts(parts)).toEqual([
      { kind: 'text', parts: [text('First.'), text('Second.')] },
      { kind: 'trace' },
      {
        kind: 'tabLinks',
        parts: [
          { type: 'tabLink', workflowId: 'wf-1' },
          { type: 'tabLink', workflowId: 'wf-2' }
        ]
      },
      { kind: 'text', parts: [text('Third.')] }
    ])
  })

  it('leaves a run turn as trace and text unless folding is asked for', () => {
    const expected = [
      { kind: 'trace' },
      {
        kind: 'text',
        parts: [text('Running it now.'), text('Here is the result.')]
      }
    ]

    expect(groupMessageParts(runTurn())).toEqual(expected)
    expect(groupMessageParts(runTurn(), { foldRuns: false })).toEqual(expected)
    expect(
      groupMessageParts(runTurn(), { foldRuns: false, streaming: true })
    ).toEqual(expected)
  })

  it('emits one run group where the run call sits when folding', () => {
    expect(groupMessageParts(runTurn(), { foldRuns: true })).toEqual([
      { kind: 'trace' },
      { kind: 'text', parts: [text('Running it now.')] },
      {
        kind: 'run',
        slot: {
          callId: 'run-1',
          run: 'ok',
          wait: 'ok',
          output: 'ok',
          awaitingApproval: false,
          turnLive: false
        }
      },
      { kind: 'text', parts: [text('Here is the result.')] }
    ])
  })

  it('emits run groups in order and carries the live turn into each slot', () => {
    const parts: MessagePart[] = [
      tool('run-1', 'run'),
      tool('wait-1', 'wait_for_job'),
      tool('set-1', 'set_widget'),
      tool('run-2', 'run'),
      tool('wait-2', 'wait_for_job', 'streaming')
    ]

    expect(
      groupMessageParts(parts, { foldRuns: true, streaming: true })
    ).toEqual([
      {
        kind: 'run',
        slot: {
          callId: 'run-1',
          run: 'ok',
          wait: 'ok',
          output: 'absent',
          awaitingApproval: false,
          turnLive: true
        }
      },
      { kind: 'trace' },
      {
        kind: 'run',
        slot: {
          callId: 'run-2',
          run: 'ok',
          wait: 'running',
          output: 'absent',
          awaitingApproval: false,
          turnLive: true
        }
      }
    ])
  })

  it('places no trace when a run owns every tool call', () => {
    const parts: MessagePart[] = [
      tool('run-1', 'run'),
      tool('wait-1', 'wait_for_job'),
      tool('out-1', 'get_output')
    ]

    expect(kindsOf(groupMessageParts(parts, { foldRuns: true }))).toEqual([
      'run'
    ])
  })

  it('keeps a wait with no earlier run in the trace when folding', () => {
    const parts: MessagePart[] = [
      tool('wait-0', 'wait_for_job'),
      tool('run-1', 'run')
    ]

    expect(kindsOf(groupMessageParts(parts, { foldRuns: true }))).toEqual([
      'trace',
      'run'
    ])
  })
})
