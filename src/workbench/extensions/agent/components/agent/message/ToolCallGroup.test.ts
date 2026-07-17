import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { TurnId } from '../../../schemas/agentApiSchema'
import type {
  AssistantMessage,
  ToolPart
} from '../../../services/agent/agentMessageParts'

import AgentMessage from './AgentMessage.vue'
import ToolCallGroup from './ToolCallGroup.vue'

function tool(
  callId: string,
  name: string,
  state: ToolPart['state'],
  ok?: boolean
): ToolPart {
  return { type: 'tool', callId, name, state, ok }
}

describe('ToolCallGroup', () => {
  it('maps tab tools to friendly labels and renders unknown tools by raw name', () => {
    render(ToolCallGroup, {
      props: {
        tools: [
          tool('c1', 'new_tab', 'done', true),
          tool('c2', 'switch_tab', 'done', true),
          tool('c3', 'add_node', 'streaming'),
          tool('c4', 'constructor', 'done', true),
          tool('c5', 'remember', 'done', true),
          tool('c6', 'forget', 'done', true)
        ]
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Opened a new tab')).toBeInTheDocument()
    expect(screen.getByText('Switched tabs')).toBeInTheDocument()
    expect(screen.getByText('add_node')).toBeInTheDocument()
    expect(screen.getByText('constructor')).toBeInTheDocument()
    expect(screen.getByText('Saved a preference')).toBeInTheDocument()
    expect(screen.getByText('Forgot a preference')).toBeInTheDocument()
  })

  it('renders open with the row visible while a call streams', () => {
    render(ToolCallGroup, {
      props: { tools: [tool('c1', 'add_node', 'streaming')] },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Ran 1 tool call')).toBeInTheDocument()
    expect(screen.getByText('add_node')).toBeInTheDocument()
  })

  it('stays open and folds a same-name re-run into the counted row', () => {
    render(ToolCallGroup, {
      props: {
        tools: [
          tool('c1', 'add_node', 'done', true),
          tool('c2', 'add_node', 'streaming')
        ]
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Ran 2 tool calls')).toBeInTheDocument()
    expect(screen.getAllByText('add_node')).toHaveLength(1)
    expect(screen.getByText('×2')).toBeInTheDocument()
  })

  it('reopens on a failure and folds it into the counted row', async () => {
    const { rerender } = render(ToolCallGroup, {
      props: { tools: [tool('c1', 'add_node', 'done', true)] },
      global: { plugins: [i18n] }
    })

    expect(screen.queryByText('add_node')).not.toBeInTheDocument()

    await rerender({
      tools: [
        tool('c1', 'add_node', 'done', true),
        tool('c2', 'add_node', 'done', false)
      ]
    })

    expect(await screen.findByText('add_node')).toBeInTheDocument()
    expect(screen.getByText('×2')).toBeInTheDocument()
  })
})

describe('AgentMessage tool grouping', () => {
  it('groups adjacent tool parts into one pluralized card that opens on click', async () => {
    const message: AssistantMessage = {
      id: 'msg-1' as TurnId,
      role: 'assistant',
      parts: [
        tool('c1', 'add_node', 'done', true),
        tool('c2', 'add_node', 'done', true)
      ],
      streaming: false,
      thinking: false
    }
    render(AgentMessage, { props: { message }, global: { plugins: [i18n] } })

    expect(screen.getByText('Ran 2 tool calls')).toBeInTheDocument()
    expect(screen.queryByText('add_node')).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: /ran 2 tool calls/i })
    )

    expect(await screen.findAllByText('add_node')).toHaveLength(1)
    expect(screen.getByText('×2')).toBeInTheDocument()
  })
})
