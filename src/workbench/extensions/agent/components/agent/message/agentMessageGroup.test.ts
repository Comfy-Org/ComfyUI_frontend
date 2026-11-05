import { describe, expect, it } from 'vitest'

import type {
  AskUserPart,
  MessagePart,
  RunApprovalPart,
  ToolPart
} from '@/workbench/extensions/agent/services/agent/agentMessageParts'

import { groupMessageParts } from './agentMessageGroup'

function tool(callId: string): ToolPart {
  return { type: 'tool', callId, name: 'add_node', state: 'done', ok: true }
}

const ask: AskUserPart = {
  type: 'askUser',
  askId: 'turn-1:call-1',
  prompt: 'Which model?',
  options: [{ id: 'sdxl', label: 'SDXL' }],
  minSelections: 1,
  maxSelections: 1,
  allowOther: false,
  resolution: { status: 'answered', selected: ['sdxl'] }
}

const approval: RunApprovalPart = {
  type: 'runApproval',
  askId: 'turn-1:call-2',
  workflowName: 'Draft'
}

function shape(parts: MessagePart[]) {
  return groupMessageParts(parts).map((group) =>
    group.kind === 'trace'
      ? `trace(${group.parts.map((part) => (part.type === 'tool' ? part.callId : 'thinking')).join(',')})`
      : group.kind
  )
}

describe('groupMessageParts', () => {
  it('keeps every step of a turn without a card in one trace, across text', () => {
    expect(
      shape([
        tool('a'),
        { type: 'text', text: 'Between calls', state: 'done' },
        { type: 'thinking', text: 'Checking', state: 'done' },
        tool('b')
      ])
    ).toEqual(['trace(a,thinking,b)', 'text'])
  })

  it('draws steps after an answered question below its card', () => {
    expect(shape([tool('a'), ask, tool('b'), tool('c')])).toEqual([
      'trace(a)',
      'askUser',
      'trace(b,c)'
    ])
  })

  it('starts a new trace after each run approval', () => {
    expect(
      shape([
        tool('a'),
        approval,
        { type: 'thinking', text: 'Running', state: 'done' },
        ask,
        tool('b'),
        { type: 'text', text: 'Done', state: 'done' }
      ])
    ).toEqual([
      'trace(a)',
      'runApproval',
      'trace(thinking)',
      'askUser',
      'trace(b)',
      'text'
    ])
  })

  it('does not split the trace at an informational notice', () => {
    expect(
      shape([
        tool('a'),
        { type: 'notice', level: 'info', text: 'Saved locally' },
        tool('b')
      ])
    ).toEqual(['trace(a,b)', 'notice'])
  })
})
