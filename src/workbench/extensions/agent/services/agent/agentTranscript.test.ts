import { describe, expect, it } from 'vitest'

import type { TurnId } from '../../schemas/agentApiSchema'
import type { AssistantMessage } from './agentMessageParts'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'

import { buildTranscriptMarkdown } from './agentTranscript'

describe('buildTranscriptMarkdown', () => {
  it('renders a user line and an assistant line from a turn', () => {
    const assistant: AssistantMessage = {
      id: 'm-1' as TurnId,
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Here is ', state: 'done' },
        { type: 'tool', callId: 'tool_0', name: 'add_node', state: 'done' },
        { type: 'text', text: 'a cat.', state: 'done' }
      ],
      streaming: false,
      thinking: false
    }
    const entries: ConversationEntry[] = [
      { id: 'm-1' as TurnId, role: 'user', text: 'make a cat' },
      assistant
    ]

    const md = buildTranscriptMarkdown(entries)

    expect(md).toContain('**You:** make a cat')
    // Text parts concatenate; the tool part contributes no plain-markdown body.
    expect(md).toContain('**Agent:** Here is a cat.')
  })
})
