// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// jsdom lacks ResizeObserver, which the asset-preview import chain references.
vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
})

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
  it('renders complete asset URLs as hyperlinks', () => {
    const message: AssistantMessage = {
      ...createAssistantMessage('msg-link' as TurnId),
      streaming: false,
      parts: [
        {
          type: 'text',
          text: '[Download result](https://assets.example/result.png)',
          state: 'done'
        }
      ]
    }
    render(AgentMessage, {
      props: { message },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByRole('link', { name: 'Download result' })
    ).toHaveAttribute('href', 'https://assets.example/result.png')
  })

  it('opens the Markdown copy action menu', async () => {
    const message: AssistantMessage = {
      ...createAssistantMessage('msg-actions' as TurnId),
      streaming: false,
      parts: [{ type: 'text', text: '**Ready**', state: 'done' }]
    }
    render(AgentMessage, {
      props: { message },
      global: { plugins: [i18n] }
    })

    await userEvent.click(
      screen.getByRole('button', { name: /copy as markdown/i })
    )

    expect(
      await screen.findByRole('menuitem', { name: /copy as markdown/i })
    ).toBeVisible()
  })

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

  it('retains separate thought and tool phases as they settle', async () => {
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
        tool_call_id: 'call-set-widget',
        tool_name: 'set_widget',
        status: 'success',
        message_id: 'msg-0',
        thread_id: 'thread-0'
      }
    })
    await rerender({ message })

    expect(screen.getByRole('button', { name: /thought/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(
      screen.getByRole('button', { name: /ran 1 tool call/i })
    ).toHaveAttribute('aria-expanded', 'true')

    transport.ingest({
      type: 'agent_message_done',
      data: { message_id: 'msg-0', thread_id: 'thread-0' }
    })
    await rerender({ message })

    expect(screen.getByText('Ran 1 tool call')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /ran 1 tool call/i })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /thought/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    )

    await userEvent.click(screen.getByRole('button', { name: /thought/i }))
    expect(screen.getByText('Thinking...')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: /ran 1 tool call/i })
    )
    expect(screen.getByText('Set widget')).toBeInTheDocument()
  })

  it('shows resumed thinking after the completed tool group', async () => {
    const message = thinkingMessage('Planning the next step')
    message.parts = [
      { type: 'tool', callId: 'tool_0', name: 'set_widget', state: 'done' },
      { type: 'text', text: 'The first edit is complete.', state: 'done' },
      {
        type: 'thinking',
        text: 'Planning the next step',
        state: 'streaming'
      }
    ]
    render(AgentMessage, {
      props: { message },
      global: { plugins: [i18n] }
    })

    const summary = screen.getByRole('button', { name: /thinking/i })
    const thinking = screen.getByText('Planning the next step')

    expect(summary).toBeInTheDocument()
    expect(screen.getByText('The first edit is complete.')).toBeInTheDocument()
    expect(thinking).not.toHaveClass('agent-shimmer-text')
    expect(screen.getByText('Thinking...')).toHaveClass('agent-shimmer-text')
    expect(
      screen.getByRole('button', { name: /ran 1 tool call/i })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(summary).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByText('Set widget')).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: /ran 1 tool call/i })
    )
    expect(screen.getByText('Set widget')).toBeInTheDocument()
  })

  it('keeps text-separated tool runs as separate completed phases', () => {
    const message = thinkingMessage()
    message.thinking = false
    message.streaming = false
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
    expect(
      summaries[0].compareDocumentPosition(narration) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      narration.compareDocumentPosition(summaries[1]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('matches the completed Figma sequence of separate expandable phases', async () => {
    const message = thinkingMessage()
    message.thinking = false
    message.streaming = false
    message.parts = [
      {
        type: 'thinking',
        text: 'Inspecting the graph',
        state: 'done',
        durationMs: 1300
      },
      {
        type: 'tool',
        callId: 'tool_0',
        name: 'list_slots',
        state: 'done',
        durationMs: 500
      },
      {
        type: 'tool',
        callId: 'tool_1',
        name: 'set_widget',
        state: 'done',
        durationMs: 800
      },
      {
        type: 'thinking',
        text: 'Checking the result',
        state: 'done',
        durationMs: 700
      },
      { type: 'text', text: 'The workflow is ready.', state: 'done' }
    ]
    render(AgentMessage, {
      props: { message },
      global: { plugins: [i18n] }
    })

    const phases = screen.getAllByRole('button', {
      name: /^(thought|ran)/i
    })
    expect(phases.map((phase) => phase.textContent)).toEqual([
      'Thought for 1.3 seconds',
      'Ran 2 tool calls for 1.3 seconds',
      'Thought for 0.7 seconds'
    ])
    expect(
      phases.every((phase) => phase.getAttribute('aria-expanded') === 'false')
    ).toBe(true)
    expect(screen.getByText('The workflow is ready.')).toBeInTheDocument()

    await userEvent.click(phases[0])
    await userEvent.click(phases[1])
    await userEvent.click(phases[2])
    expect(screen.getByText('Inspecting the graph')).toBeInTheDocument()
    expect(screen.getByText('List slots')).toBeInTheDocument()
    expect(screen.getByText('Set widget')).toBeInTheDocument()
    expect(screen.getByText('Checking the result')).toBeInTheDocument()
  })
})

describe('AgentMessage fallback content', () => {
  it('groups adjacent workflow links and renders notice severities', () => {
    const message: AssistantMessage = {
      ...thinkingMessage(),
      streaming: false,
      thinking: false,
      parts: [
        { type: 'tabLink', workflowId: 'workflow-1', name: 'First workflow' },
        { type: 'tabLink', workflowId: 'workflow-2', name: 'Second workflow' },
        { type: 'notice', level: 'info', text: 'Saved locally' },
        { type: 'notice', level: 'error', text: 'Could not publish' }
      ]
    }

    render(AgentMessage, {
      props: { message },
      global: {
        plugins: [i18n],
        stubs: {
          TabLinkCard: {
            props: ['workflowId', 'name'],
            template:
              '<span data-testid="tab-link">{{ workflowId }}:{{ name }}</span>'
          }
        }
      }
    })

    expect(
      within(screen.getByRole('group')).getAllByTestId('tab-link')
    ).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent('Saved locally')
    expect(screen.getByRole('alert')).toHaveTextContent('Could not publish')
  })

  it('hides completed thinking when the response did not use tools', () => {
    const message: AssistantMessage = {
      ...thinkingMessage(),
      streaming: false,
      thinking: false,
      parts: [
        {
          type: 'thinking',
          text: 'Reasoning before the answer',
          state: 'done'
        },
        { type: 'text', text: 'Finished without tools', state: 'done' }
      ]
    }

    render(AgentMessage, {
      props: { message },
      global: { plugins: [i18n] }
    })

    expect(
      screen.queryByText('Reasoning before the answer')
    ).not.toBeInTheDocument()
    expect(screen.getByText('Finished without tools')).toBeInTheDocument()
  })

  it('forwards feedback from a completed text response', async () => {
    const message: AssistantMessage = {
      ...thinkingMessage(),
      streaming: false,
      thinking: false,
      parts: [{ type: 'text', text: 'Finished', state: 'done' }]
    }

    const { emitted } = render(AgentMessage, {
      props: { message },
      global: {
        plugins: [i18n],
        stubs: {
          MessageFeedback: {
            emits: ['feedback'],
            template:
              '<button type="button" @click="$emit(\'feedback\', \'up\')">Vote up</button>'
          }
        }
      }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Vote up' }))

    expect(emitted().feedback).toEqual([['up']])
  })
})
