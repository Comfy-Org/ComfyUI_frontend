import { describe, expect, it } from 'vitest'

import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import { normalizeAgentTranscript } from './agentTranscript'

const row = (
  seq: number,
  role: AgentMessages[number]['role'],
  turnId: string,
  text: string,
  id: string
): AgentMessages[number] => ({
  id,
  thread_id: 'thread-1',
  seq,
  role,
  status: 'complete',
  turn_id: turnId,
  content: { text }
})

describe('normalizeAgentTranscript', () => {
  it('orders rows by sequence and groups them by stable turn identity', () => {
    const transcript = normalizeAgentTranscript([
      row(4, 'assistant', 'turn-b', 'Second reply', 'row-4'),
      row(2, 'assistant', 'turn-a', 'First reply', 'row-2'),
      row(1, 'user', 'turn-a', 'First prompt', 'row-1'),
      row(3, 'user', 'turn-b', 'Second prompt', 'row-3')
    ])

    expect(transcript.messages.map((message) => message.id)).toEqual([
      'turn-a',
      'turn-b'
    ])
    expect(transcript.userTexts.get('turn-a' as TurnId)).toBe('First prompt')
    expect(transcript.messages[0].parts).toEqual([
      { type: 'text', text: 'First reply', state: 'done' }
    ])
    expect(transcript.rowIds).toEqual(
      new Set(['row-1', 'row-2', 'row-3', 'row-4'])
    )
  })

  it('keeps message identity stable when persisted row ids change', () => {
    const first = normalizeAgentTranscript([
      row(1, 'user', 'turn-a', 'Prompt', 'user-row-v1'),
      row(2, 'assistant', 'turn-a', 'Reply', 'assistant-row-v1')
    ])
    const refreshed = normalizeAgentTranscript([
      row(1, 'user', 'turn-a', 'Prompt', 'user-row-v2'),
      row(2, 'assistant', 'turn-a', 'Reply', 'assistant-row-v2')
    ])

    expect(refreshed.messages[0].id).toBe(first.messages[0].id)
    expect(refreshed.messages[0].id).toBe('turn-a')
    expect(refreshed.assistantTurnIds).toEqual(new Set(['turn-a']))
  })

  it('keeps user-only turns while ignoring non-text transcript content', () => {
    const userOnly = row(1, 'user', 'turn-a', 'Prompt', 'row-1')
    const toolRow = row(2, 'tool', 'turn-a', '', 'row-2')
    toolRow.content = { result: { nodeCount: 2 } }

    const transcript = normalizeAgentTranscript([toolRow, userOnly])

    expect(transcript.messages).toEqual([
      {
        id: 'turn-a',
        role: 'assistant',
        parts: [],
        thinking: false,
        streaming: false
      }
    ])
    expect(transcript.userTexts.get('turn-a' as TurnId)).toBe('Prompt')
    expect(transcript.assistantTurnIds).toEqual(new Set())
    expect(transcript.rowIds).toEqual(new Set(['row-1', 'row-2']))
  })
})
