import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { TurnId } from '../../../schemas/agentApiSchema'
import type { AssistantMessage } from '../../../services/agent/agentMessageParts'

import AgentMessage from './AgentMessage.vue'

function thinkingMessage(thinkingText?: string): AssistantMessage {
  return {
    id: 'msg-0' as TurnId,
    role: 'assistant',
    parts: [],
    streaming: true,
    thinking: true,
    thinkingText
  }
}

describe('AgentMessage thinking narration', () => {
  it('shows the live narration text while thinking', () => {
    render(AgentMessage, {
      props: { message: thinkingMessage('Reading the graph') },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Reading the graph')).toBeInTheDocument()
    expect(screen.queryByText('Thinking...')).not.toBeInTheDocument()
  })

  it('falls back to the static label without narration', () => {
    render(AgentMessage, {
      props: { message: thinkingMessage() },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Thinking...')).toBeInTheDocument()
  })
})
