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
  ok?: boolean,
  durationMs?: number
): ToolPart {
  return { type: 'tool', callId, name, state, ok, durationMs }
}

describe('ToolCallGroup', () => {
  it('maps tab tools to friendly labels and humanizes unknown tool names', () => {
    render(ToolCallGroup, {
      props: {
        parts: [
          tool('c1', 'new_tab', 'done', true),
          tool('c2', 'switch_tab', 'done', true),
          tool('c3', 'add_node', 'streaming'),
          tool('c4', 'constructor', 'done', true),
          tool('c5', 'remember', 'done', true),
          tool('c6', 'forget', 'done', true),
          tool('c7', 'resize_image_node', 'done', true)
        ]
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Opened a new tab')).toBeInTheDocument()
    expect(screen.getByText('Switched tabs')).toBeInTheDocument()
    expect(screen.getByText('Add node')).toBeInTheDocument()
    expect(screen.getByText('Resize image node')).toBeInTheDocument()
    expect(screen.getByText('Constructor')).toBeInTheDocument()
    expect(screen.getByText('Saved a preference')).toBeInTheDocument()
    expect(screen.getByText('Forgot a preference')).toBeInTheDocument()
  })

  it('renders open with the row visible while a call streams', () => {
    render(ToolCallGroup, {
      props: { parts: [tool('c1', 'add_node', 'streaming')] },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Ran 1 tool call')).toBeInTheDocument()
    expect(screen.getByText('Add node')).toBeInTheDocument()
  })

  it('stays open and folds a same-name re-run into the counted row', () => {
    render(ToolCallGroup, {
      props: {
        parts: [
          tool('c1', 'add_node', 'done', true),
          tool('c2', 'add_node', 'streaming')
        ]
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Ran 2 tool calls')).toBeInTheDocument()
    expect(screen.getAllByText('Add node')).toHaveLength(1)
    expect(screen.getByText('×2')).toBeInTheDocument()
  })

  it('shows per-row and total durations from the wire timings', async () => {
    render(ToolCallGroup, {
      props: {
        parts: [
          tool('c1', 'add_node', 'done', true, 1300),
          tool('c2', 'add_node', 'done', true, 200),
          tool('c3', 'switch_tab', 'done', true, 500)
        ]
      },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByText('Ran 3 tool calls for 2.0 seconds')
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', {
        name: /ran 3 tool calls for 2.0 seconds/i
      })
    )
    expect(screen.getByText('1.5s')).toBeInTheDocument()
    expect(screen.getByText('0.5s')).toBeInTheDocument()
  })

  it('keeps the untimed label when no durations arrive', () => {
    render(ToolCallGroup, {
      props: { parts: [tool('c1', 'add_node', 'done', true)] },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Ran 1 tool call')).toBeInTheDocument()
  })

  it('T-11 / PM-661 / FE-1301 streams tool calls open and folds them on completion', async () => {
    const { rerender } = render(ToolCallGroup, {
      props: {
        parts: [tool('c1', 'add_node', 'done', true)],
        active: true
      },
      global: { plugins: [i18n] }
    })

    const trigger = screen.getByRole('button', { name: /ran 1 tool call/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Add node')).toBeInTheDocument()

    await rerender({
      parts: [tool('c1', 'add_node', 'done', true)],
      active: false
    })

    expect(
      screen.getByRole('button', { name: /ran 1 tool call/i })
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('reopens on a failure and folds it into the counted row', async () => {
    const { rerender } = render(ToolCallGroup, {
      props: { parts: [tool('c1', 'add_node', 'done', true)] },
      global: { plugins: [i18n] }
    })

    expect(screen.queryByText('Add node')).not.toBeInTheDocument()

    await rerender({
      parts: [
        tool('c1', 'add_node', 'done', true),
        tool('c2', 'add_node', 'done', false)
      ]
    })

    expect(await screen.findByText('Add node')).toBeInTheDocument()
    expect(screen.getByText('×2')).toBeInTheDocument()
  })

  it('T-12 / PM-667 / FE-1303 replaces active thinking shimmer with the completed summary', async () => {
    const { rerender } = render(ToolCallGroup, {
      props: {
        parts: [
          {
            type: 'thinking',
            text: 'Inspecting the graph',
            state: 'streaming'
          }
        ],
        active: true
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('button', { name: /thinking/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByText('Inspecting the graph')).toBeInTheDocument()

    await rerender({
      parts: [
        {
          type: 'thinking',
          text: 'Inspecting the graph',
          state: 'done',
          durationMs: 1300
        }
      ],
      active: false
    })

    expect(
      screen.getByRole('button', { name: /thought for 1.3 seconds/i })
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders mixed rows in event order when supplied', () => {
    render(ToolCallGroup, {
      props: {
        parts: [
          { type: 'thinking', text: 'Inspecting the graph', state: 'done' },
          tool('c1', 'list_slots', 'done', true),
          { type: 'thinking', text: 'Applying the edit', state: 'done' },
          tool('c2', 'set_widget', 'done', true)
        ],
        active: true
      },
      global: { plugins: [i18n] }
    })

    const rows = screen.getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      'Inspecting the graph',
      'List slots',
      'Applying the edit',
      'Set widget'
    ])
  })
})

describe('AgentMessage tool grouping', () => {
  it('keeps the current tool phase expanded while streaming', () => {
    const message: AssistantMessage = {
      id: 'msg-0' as TurnId,
      role: 'assistant',
      parts: [tool('c1', 'add_node', 'done', true)],
      streaming: true,
      thinking: false
    }
    render(AgentMessage, { props: { message }, global: { plugins: [i18n] } })

    expect(
      screen.getByRole('button', { name: /ran 1 tool call/i })
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Add node')).toBeInTheDocument()
  })

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
    expect(screen.queryByText('Add node')).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: /ran 2 tool calls/i })
    )

    expect(await screen.findAllByText('Add node')).toHaveLength(1)
    expect(screen.getByText('×2')).toBeInTheDocument()
  })
})
