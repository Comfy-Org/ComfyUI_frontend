import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { TurnId } from '../../../schemas/agentApiSchema'
import { createAgentEventTransport } from '../../../services/agent/agentEventTransport'
import type { AssistantMessage } from '../../../services/agent/agentMessageParts'
import { createAssistantMessage } from '../../../services/agent/agentMessageParts'

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

  it('replaces thinking with the active tool summary, then settles it', async () => {
    let message = createAssistantMessage('msg-0' as TurnId)
    const transport = createAgentEventTransport(message, (next) => {
      message = next
    })
    transport.ingest({
      type: 'agent_thinking',
      data: {
        delta: 'Thinking...',
        message_id: 'msg-0',
        thread_id: 'thread-0'
      }
    })

    const { rerender } = render(AgentMessage, {
      props: { message },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Thinking...')).toBeInTheDocument()

    transport.ingest({
      type: 'agent_tool_call',
      data: {
        tool_name: 'set_widget',
        status: 'ok',
        args: [],
        message_id: 'msg-0',
        thread_id: 'thread-0'
      }
    })
    await rerender({ message })

    expect(screen.getByText('Ran 1 tool call')).toBeInTheDocument()
    expect(screen.queryByText('Thinking...')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /ran 1 tool call/i })
    ).toHaveAttribute('aria-expanded', 'true')

    transport.ingest({
      type: 'agent_message_done',
      data: { message_id: 'msg-0', thread_id: 'thread-0' }
    })
    await rerender({ message })

    expect(screen.getByText('Ran 1 tool call')).toBeInTheDocument()
    expect(screen.queryByText('Thinking...')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /ran 1 tool call/i })
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows resumed thinking after a completed tool group', () => {
    const message = thinkingMessage('Planning the next step')
    message.parts = [
      { type: 'tool', callId: 'tool_0', name: 'set_widget', state: 'done' }
    ]
    render(AgentMessage, {
      props: { message },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Ran 1 tool call')).toBeInTheDocument()
    expect(screen.getByText('Planning the next step')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /ran 1 tool call/i })
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps text-separated tool runs as distinct summaries', () => {
    const message = thinkingMessage()
    message.thinking = false
    message.parts = [
      { type: 'tool', callId: 'tool_0', name: 'set_widget', state: 'done' },
      { type: 'text', text: 'Between calls', state: 'done' },
      { type: 'tool', callId: 'tool_1', name: 'add_node', state: 'done' }
    ]
    render(AgentMessage, {
      props: { message },
      global: { plugins: [i18n] }
    })

    const summaries = screen.getAllByRole('button', {
      name: /ran 1 tool call/i
    })
    const narration = screen.getByText('Between calls')

    expect(summaries).toHaveLength(2)
    expect(screen.queryByText('Set widget')).not.toBeInTheDocument()
    expect(screen.getByText('Add node')).toBeInTheDocument()
    expect(
      summaries[0].compareDocumentPosition(narration) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      narration.compareDocumentPosition(summaries[1]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})
