import { describe, expect, it } from 'vitest'

import type {
  AskUserPart,
  DeleteApprovalPart,
  MessagePart,
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

const deleteApproval: DeleteApprovalPart = {
  type: 'deleteApproval',
  askId: 'turn-1:call-2',
  prompt: 'Delete the node you added?',
  nodes: [{ id: '12', name: 'KSampler' }],
  hiddenNodeCount: 0,
  resolution: { status: 'answered', selected: ['delete'] }
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

  it('starts a new trace after each answered card', () => {
    expect(
      shape([
        tool('a'),
        deleteApproval,
        { type: 'thinking', text: 'Deleting', state: 'done' },
        ask,
        tool('b'),
        { type: 'text', text: 'Done', state: 'done' }
      ])
    ).toEqual([
      'trace(a)',
      'deleteApproval',
      'trace(thinking)',
      'askUser',
      'trace(b)',
      'text'
    ])
  })

  it('starts a new trace after a card that could not be shown', () => {
    expect(
      shape([
        tool('a'),
        { type: 'askUnavailable', askId: 'turn-1:call-3' },
        tool('b')
      ])
    ).toEqual(['trace(a)', 'notice', 'trace(b)'])
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
