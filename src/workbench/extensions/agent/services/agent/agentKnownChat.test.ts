import { describe, expect, it } from 'vitest'

import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { AgentMessages } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { createAssistantMessage } from '@/workbench/extensions/agent/services/agent/agentMessageParts'

import type { KnownTurnSnapshot } from './agentKnownChat'
import {
  alignKnownChatHistory,
  latestWorkflowIdOf,
  pruneSettledLocalTurns
} from './agentKnownChat'

function userRow(
  seq: number,
  turnId: string,
  text: string,
  id = `u-${seq}`,
  clientMessageId?: string
): AgentMessages[number] {
  return {
    id,
    thread_id: 'th-1',
    seq,
    role: 'user',
    status: 'complete',
    turn_id: turnId,
    content: {
      text,
      ...(clientMessageId ? { client_message_id: clientMessageId } : {})
    }
  }
}

function assistantRow(
  seq: number,
  turnId: string,
  id: string,
  status: AgentMessages[number]['status'] = 'complete',
  workflowId?: string
): AgentMessages[number] {
  return {
    id,
    thread_id: 'th-1',
    seq,
    role: 'assistant',
    status,
    turn_id: turnId,
    ...(workflowId ? { workflow_id: workflowId } : {}),
    content: { text: '' }
  }
}

function localTurn(
  turnId: string,
  userText: string,
  clientMessageId?: string
): KnownTurnSnapshot {
  return {
    turnId: toTurnId(turnId),
    clientMessageId,
    userText,
    message: createAssistantMessage(toTurnId(turnId))
  }
}

describe('alignKnownChatHistory', () => {
  it('aligns user and assistant rows by strict assistant id and client_message_id', () => {
    const history: AgentMessages = [
      userRow(1, 'srv-turn-1', 'hi', 'u-1', 'cm-1'),
      assistantRow(2, 'srv-turn-1', 'msg-1', 'complete', 'wf-1')
    ]
    const result = alignKnownChatHistory(
      history,
      [],
      [localTurn('msg-1', 'hi', 'cm-1')]
    )
    expect(result.status).toBe('aligned')
    if (result.status !== 'aligned') return
    expect(result.history.map((r) => r.turn_id)).toEqual(['msg-1', 'msg-1'])
    expect(result.settledServerTurns).toEqual(new Set([toTurnId('msg-1')]))
  })

  it('rejects unowned streaming turns when no local turns exist', () => {
    const history: AgentMessages = [
      userRow(1, 'srv-1', 'hi'),
      assistantRow(2, 'srv-1', 'msg-other', 'streaming')
    ]
    expect(alignKnownChatHistory(history, [], [])).toEqual({
      status: 'unowned-streaming'
    })
  })

  it('rejects an unowned streaming turn even when local turns already match', () => {
    const history: AgentMessages = [
      userRow(1, 'srv-1', 'hi', 'u-1', 'cm-1'),
      assistantRow(2, 'srv-1', 'msg-1', 'complete'),
      userRow(3, 'srv-2', 'other device'),
      assistantRow(4, 'srv-2', 'msg-other', 'streaming')
    ]
    expect(
      alignKnownChatHistory(history, [], [localTurn('msg-1', 'hi', 'cm-1')])
    ).toEqual({ status: 'unowned-streaming' })
  })

  it('keeps multi-row turns unsettled when a newer assistant row is streaming', () => {
    const history: AgentMessages = [
      userRow(1, 'srv-turn-1', 'run'),
      assistantRow(2, 'srv-turn-1', 'msg-1', 'complete'),
      assistantRow(3, 'srv-turn-1', 'row-stream-3', 'streaming')
    ]
    const result = alignKnownChatHistory(
      history,
      [],
      [localTurn('msg-1', 'run')]
    )
    expect(result.status).toBe('aligned')
    if (result.status !== 'aligned') return
    expect(result.settledServerTurns.size).toBe(0)
  })

  it('returns ambiguous when a multi-row turn only exposes a newer streaming row without the anchor', () => {
    const history: AgentMessages = [
      userRow(1, 'srv-turn-1', 'run'),
      assistantRow(2, 'srv-turn-1', 'row-stream-only', 'streaming')
    ]
    expect(
      alignKnownChatHistory(history, [], [localTurn('msg-1', 'run')])
    ).toEqual({ status: 'ambiguous' })
  })

  it('returns ambiguous on un-keyed user-only rows instead of guessing by text', () => {
    const history: AgentMessages = [userRow(1, 'srv-turn-1', 'hi')]
    expect(
      alignKnownChatHistory(history, [], [localTurn('msg-1', 'hi')])
    ).toEqual({ status: 'ambiguous' })
  })

  it('never merges two identical prompts with different client_message_ids', () => {
    const history: AgentMessages = [
      userRow(1, 'srv-1', 'hi', 'u-1', 'cm-1'),
      assistantRow(2, 'srv-1', 'msg-1', 'complete'),
      userRow(3, 'srv-2', 'hi', 'u-2', 'cm-2')
    ]
    const result = alignKnownChatHistory(
      history,
      [],
      [localTurn('msg-1', 'hi', 'cm-1'), localTurn('msg-2', 'hi', 'cm-2')]
    )
    expect(result.status).toBe('aligned')
    if (result.status !== 'aligned') return
    expect(result.history.map((r) => r.turn_id)).toEqual([
      'msg-1',
      'msg-1',
      'msg-2'
    ])
  })

  it('returns ambiguous if server turn ids conflict across local turns', () => {
    const history: AgentMessages = [
      userRow(1, 'srv-shared', 'hi', 'u-1', 'cm-1'),
      assistantRow(2, 'srv-shared', 'msg-2', 'complete')
    ]
    expect(
      alignKnownChatHistory(
        history,
        [],
        [localTurn('msg-1', 'hi', 'cm-1'), localTurn('msg-2', 'hi', 'cm-2')]
      )
    ).toEqual({ status: 'ambiguous' })
  })

  it('prunes only locally settled turns and finds latest workflow id', () => {
    const turns = [localTurn('msg-1', 'a'), localTurn('msg-2', 'b')]
    expect(pruneSettledLocalTurns(turns, new Set([toTurnId('msg-1')]))).toEqual(
      [turns[1]]
    )
    expect(
      latestWorkflowIdOf([
        assistantRow(1, 't1', 'm1', 'complete', 'wf-1'),
        assistantRow(2, 't2', 'm2', 'complete', 'wf-2')
      ])
    ).toBe('wf-2')
  })
})
