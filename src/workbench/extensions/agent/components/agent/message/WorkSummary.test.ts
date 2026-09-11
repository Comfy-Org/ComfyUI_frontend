import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { ToolPart } from '../../../services/agent/agentMessageParts'

import ActivityTrace from './ActivityTrace.vue'
import WorkSummary from './WorkSummary.vue'

function tool(
  callId: string,
  name: string,
  state: ToolPart['state'],
  ok?: boolean,
  durationMs?: number
): ToolPart {
  return { type: 'tool', callId, name, state, ok, durationMs }
}

describe('ActivityTrace', () => {
  it('falls back to the bare label before any narration arrives', () => {
    render(ActivityTrace, {
      props: { parts: [{ type: 'thinking', text: '', state: 'streaming' }] },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Thinking...')).toBeInTheDocument()
    expect(screen.getByRole('listitem').textContent.trim()).toBe('Thinking...')
  })

  it('keeps an apostrophe out of i18n parameter escaping', () => {
    render(ActivityTrace, {
      props: {
        parts: [{ type: 'thinking', text: "I'll build a graph", state: 'done' }]
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('listitem').textContent).toContain(
      "I'll build a graph"
    )
  })

  it('renders thinking and tool steps as one flat list in event order', () => {
    render(ActivityTrace, {
      props: {
        parts: [
          { type: 'thinking', text: 'Inspecting the graph', state: 'done' },
          tool('c1', 'list_slots', 'done', true),
          { type: 'thinking', text: 'Applying the edit', state: 'done' },
          tool('c2', 'set_widget', 'done', true)
        ]
      },
      global: { plugins: [i18n] }
    })

    expect(
      screen
        .getAllByRole('listitem')
        .map((row) => row.textContent.replace(/\s+/g, ' ').trim())
    ).toEqual([
      'Inspecting the graph',
      'List slots',
      'Applying the edit',
      'Set widget'
    ])
  })

  it('shows settled thinking time beside narration while the next step runs', async () => {
    const { rerender } = render(ActivityTrace, {
      props: {
        parts: [
          { type: 'thinking', text: 'Inspecting the graph', state: 'streaming' }
        ]
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('listitem')).toHaveTextContent(
      /^Inspecting the graph$/
    )

    await rerender({
      parts: [
        {
          type: 'thinking',
          text: 'Inspecting the graph',
          state: 'done',
          durationMs: 1400
        },
        tool('c1', 'list_slots', 'streaming')
      ]
    })

    const [thinking, nextStep] = screen.getAllByRole('listitem')
    expect(thinking).toHaveTextContent(/^Inspecting the graph\s*1\.4s$/)
    expect(within(thinking).getByText('1.4s')).toBeInTheDocument()
    expect(nextStep).toHaveTextContent('List slots')
  })

  it('folds a same-name re-run into one counted step', () => {
    render(ActivityTrace, {
      props: {
        parts: [
          tool('c1', 'add_node', 'done', true, 1300),
          tool('c2', 'add_node', 'done', true, 200)
        ]
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getAllByText('Add node')).toHaveLength(1)
    expect(screen.getByText('×2')).toBeInTheDocument()
    expect(screen.getByText('1.5s')).toBeInTheDocument()
  })

  it('maps known tools to friendly labels and humanizes the rest', () => {
    render(ActivityTrace, {
      props: {
        parts: [
          tool('c1', 'new_tab', 'done', true),
          tool('c2', 'switch_tab', 'done', true),
          tool('c3', 'remember', 'done', true),
          tool('c4', 'forget', 'done', true),
          tool('c5', 'constructor', 'done', true),
          tool('c6', 'resize_image_node', 'done', true),
          tool('c7', 'new_tab', 'streaming')
        ]
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Opened a new tab')).toBeInTheDocument()
    expect(screen.getByText('Switched tabs')).toBeInTheDocument()
    expect(screen.getByText('Saved a preference')).toBeInTheDocument()
    expect(screen.getByText('Forgot a preference')).toBeInTheDocument()
    expect(screen.getByText('Constructor')).toBeInTheDocument()
    expect(screen.getByText('Resize image node')).toBeInTheDocument()
    expect(screen.getByText('Opening a new tab')).toBeInTheDocument()
  })
})

describe('WorkSummary', () => {
  it('sums thinking and tool time into the collapsed label', () => {
    render(WorkSummary, {
      props: {
        parts: [
          {
            type: 'thinking',
            text: 'Inspecting the graph',
            state: 'done',
            durationMs: 100
          },
          tool('c1', 'add_node', 'done', true, 1300),
          tool('c2', 'switch_tab', 'done', true, 900)
        ]
      },
      global: { plugins: [i18n] }
    })

    const trigger = screen.getByRole('button', {
      name: /worked for 2.3 seconds/i
    })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Add node')).not.toBeInTheDocument()
  })

  it('reveals the whole trace on click', async () => {
    render(WorkSummary, {
      props: {
        parts: [
          {
            type: 'thinking',
            text: 'Inspecting the graph',
            state: 'done',
            durationMs: 100
          },
          tool('c1', 'add_node', 'done', true, 1300)
        ]
      },
      global: { plugins: [i18n] }
    })

    await userEvent.click(screen.getByRole('button'))

    const rows = within(screen.getByRole('list'))
    expect(rows.getByText('Add node')).toBeInTheDocument()

    expect(screen.getByText('0.1s')).toBeInTheDocument()
    expect(screen.queryByText(/^Thought/)).not.toBeInTheDocument()
    expect(screen.getByText('Inspecting the graph')).toBeInTheDocument()
  })

  it('stays collapsed even when a call failed', () => {
    render(WorkSummary, {
      props: {
        parts: [
          tool('c1', 'add_node', 'done', true, 200),
          tool('c2', 'set_widget', 'done', false, 300)
        ]
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Set widget')).not.toBeInTheDocument()
  })

  it('reads a long turn in minutes', () => {
    render(WorkSummary, {
      props: { parts: [tool('c1', 'add_node', 'done', true, 204_900)] },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByRole('button', { name: /worked for 3m 25s/i })
    ).toBeInTheDocument()
  })

  it('drops the duration from the label when no timings arrived', () => {
    render(WorkSummary, {
      props: { parts: [tool('c1', 'add_node', 'done', true)] },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByRole('button', { name: /^worked$/i })
    ).toBeInTheDocument()
  })
})
