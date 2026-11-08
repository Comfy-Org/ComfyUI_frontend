import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { i18n } from '@/i18n'

import type { TurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { createAgentEventTransport } from '@/workbench/extensions/agent/services/agent/agentEventTransport'
import type {
  AssistantMessage,
  MessagePart,
  ToolPart
} from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import { createAssistantMessage } from '@/workbench/extensions/agent/services/agent/agentMessageParts'

import AgentMessage from './AgentMessage.vue'
import { agentRunCardsKey } from './agentRunCards'

const IDS = { message_id: 'msg-0', thread_id: 'thread-0' }

function tool(
  callId: string,
  name: string,
  state: ToolPart['state'] = 'done',
  durationMs?: number
): ToolPart {
  return {
    type: 'tool',
    callId,
    name,
    state,
    ...(state === 'done' ? { ok: true } : {}),
    ...(durationMs === undefined ? {} : { durationMs })
  }
}

function message(parts: MessagePart[], streaming: boolean): AssistantMessage {
  return {
    ...createAssistantMessage('msg-0' as TurnId),
    parts,
    streaming
  }
}

function renderMessage(
  assistantMessage: AssistantMessage,
  { runCards }: { runCards: boolean }
) {
  return render(AgentMessage, {
    props: { message: assistantMessage },
    global: {
      plugins: [i18n],
      provide: runCards ? { [agentRunCardsKey as symbol]: ref(true) } : {}
    }
  })
}

function traceRows(): string[] {
  return screen
    .queryAllByRole('listitem')
    .map((row) => row.textContent.replace(/\s+/g, ' ').trim())
}

function runCard(): HTMLElement {
  return screen.getByRole('group', { name: 'Workflow run' })
}

const waitingOnJob = (): AssistantMessage =>
  message(
    [
      tool('validate-1', 'validate'),
      tool('run-1', 'run'),
      tool('wait-1', 'wait_for_job', 'streaming')
    ],
    true
  )

describe('AgentMessage run card', () => {
  it('shows a run as one card in place of its tool rows', () => {
    renderMessage(waitingOnJob(), { runCards: true })

    expect(runCard()).toHaveTextContent('Running the workflow')
    expect(within(runCard()).getByRole('progressbar')).toBeInTheDocument()
    expect(traceRows()).toEqual(['Validate'])
  })

  it('keeps the classic tool rows when run cards are not provided', () => {
    renderMessage(waitingOnJob(), { runCards: false })

    expect(
      screen.queryByRole('group', { name: 'Workflow run' })
    ).not.toBeInTheDocument()
    expect(traceRows()).toEqual(['Validate', 'Run', 'Wait for job'])
  })

  it.for([
    ['hides', true, 0],
    ['shows', false, 1]
  ] as const)(
    '%s "Working..." after the run call returns when run cards are %s',
    ([, runCards, working]) => {
      renderMessage(message([tool('run-1', 'run')], true), { runCards })

      expect(screen.queryAllByText('Working...')).toHaveLength(working)
    }
  )

  it('brings "Working..." back once the job has been waited on', () => {
    renderMessage(
      message(
        [tool('run-1', 'run'), tool('wait-1', 'wait_for_job', 'done', 12_000)],
        true
      ),
      { runCards: true }
    )

    expect(runCard()).toHaveTextContent('Ran the workflow in 12s')
    expect(screen.getByText('Working...')).toBeInTheDocument()
  })

  it('keeps "Working..." on screen while the output is collected', () => {
    renderMessage(
      message(
        [
          tool('run-1', 'run'),
          tool('wait-1', 'wait_for_job', 'done', 12_000),
          tool('out-1', 'get_output', 'streaming')
        ],
        true
      ),
      { runCards: true }
    )

    expect(runCard()).toHaveTextContent('Ran the workflow in 12s')
    expect(screen.getByText('Working...')).toBeInTheDocument()
  })

  it('shows no card while the run still waits on approval', () => {
    renderMessage(
      message(
        [
          tool('run-1', 'run', 'streaming'),
          { type: 'runApproval', askId: 'ask-1', workflowName: 'Portrait' }
        ],
        true
      ),
      { runCards: true }
    )

    expect(
      screen.queryByRole('group', { name: 'Workflow run' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Do you approve?')).toBeInTheDocument()
    expect(traceRows()).not.toContain('Run')
  })

  it('leaves a receipt and keeps the run out of the finished summary', async () => {
    renderMessage(
      message(
        [
          tool('validate-1', 'validate'),
          tool('run-1', 'run', 'done', 300),
          tool('wait-1', 'wait_for_job', 'done', 40_000),
          tool('out-1', 'get_output', 'done', 700),
          { type: 'text', text: 'Here is the result.', state: 'done' }
        ],
        false
      ),
      { runCards: true }
    )

    expect(runCard()).toHaveTextContent('Ran the workflow in 41s')
    expect(within(runCard()).queryByRole('progressbar')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^worked$/i }))

    expect(traceRows()).toEqual(['Validate'])
  })

  it('follows a live turn from starting the run to its receipt', async () => {
    let current = createAssistantMessage('msg-0' as TurnId)
    const transport = createAgentEventTransport(current, (next) => {
      current = next
    })
    const toolCall = (
      id: string,
      name: string,
      status: 'running' | 'success',
      durationMs?: number
    ) =>
      transport.ingest({
        type: 'agent_tool_call',
        data: {
          tool_call_id: id,
          tool_name: name,
          status,
          duration_ms: durationMs,
          ...IDS
        }
      })

    toolCall('run-1', 'run', 'running')
    const { rerender } = renderMessage(current, { runCards: true })

    expect(runCard()).toHaveTextContent('Starting the run')

    toolCall('run-1', 'run', 'success', 300)
    toolCall('wait-1', 'wait_for_job', 'running')
    await rerender({ message: current })

    expect(runCard()).toHaveTextContent('Running the workflow')
    expect(runCard()).toHaveTextContent(
      'Live progress is not available for this run'
    )

    toolCall('wait-1', 'wait_for_job', 'success', 71_700)
    toolCall('out-1', 'get_output', 'success', 400)
    transport.ingest({
      type: 'agent_message_delta',
      data: { delta: 'Here is the result.', ...IDS }
    })
    transport.ingest({ type: 'agent_message_done', data: IDS })
    await rerender({ message: current })

    expect(runCard()).toHaveTextContent('Ran the workflow in 1m 12s')
    expect(screen.getByText('Here is the result.')).toBeInTheDocument()
    expect(traceRows()).toEqual([])
    expect(
      screen.queryByRole('button', { name: /^worked$/i })
    ).not.toBeInTheDocument()
  })
})
