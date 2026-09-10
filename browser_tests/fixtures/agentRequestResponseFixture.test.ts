import { describe, expect, it } from 'vitest'

import { AgentRequestResponseQueue } from '@e2e/fixtures/agentRequestResponseFixture'
import type { AgentRequestResponseScenario } from '@e2e/fixtures/data/agentRequestResponse'

const scenarios = [
  {
    request: { content: 'Set the seed, then explain what changed.' },
    responses: [
      {
        kind: 'agent_event',
        event: {
          type: 'agent_message_delta',
          data: {
            delta: 'I will update the graph first.',
            message_id: 'message-1',
            thread_id: 'thread-1'
          }
        }
      },
      {
        kind: 'graph_operations',
        operations: [
          {
            op: 'set_widget',
            node_id: '7',
            widget: 'seed',
            value: 42,
            old: 3
          },
          {
            op: 'set_widget',
            node_id: '7',
            widget: 'steps',
            value: 20,
            old: 12
          }
        ]
      },
      {
        kind: 'agent_event',
        event: {
          type: 'agent_message_done',
          data: {
            message_id: 'message-1',
            thread_id: 'thread-1'
          }
        }
      }
    ]
  },
  {
    request: {
      content: 'Change the prompt.',
      workflowId: 'workflow-1',
      selection: { node_ids: ['7'] }
    },
    responses: []
  }
] as const satisfies readonly AgentRequestResponseScenario[]

describe('AgentRequestResponseQueue', () => {
  it('consumes requests and interleaved responses in declaration order', () => {
    const queue = new AgentRequestResponseQueue(scenarios)

    const responses = queue.take({
      content: 'Set the seed, then explain what changed.'
    })

    expect(responses).toBe(scenarios[0].responses)
    expect(responses.map((response) => response.kind)).toEqual([
      'agent_event',
      'graph_operations',
      'agent_event'
    ])
    expect(responses[1]).toEqual({
      kind: 'graph_operations',
      operations: [
        {
          op: 'set_widget',
          node_id: '7',
          widget: 'seed',
          value: 42,
          old: 3
        },
        {
          op: 'set_widget',
          node_id: '7',
          widget: 'steps',
          value: 20,
          old: 12
        }
      ]
    })

    expect(
      queue.take({
        content: 'Change the prompt.',
        workflowId: 'workflow-1',
        selection: { node_ids: ['7'] }
      })
    ).toBe(scenarios[1].responses)
    expect(() => queue.assertComplete()).not.toThrow()
  })

  it('rejects an out-of-order request without consuming its scenario', () => {
    const queue = new AgentRequestResponseQueue(scenarios)

    expect(() => queue.take(scenarios[1].request)).toThrow(
      'Agent request 1 did not match the declared scenario'
    )
    expect(queue.take(scenarios[0].request)).toBe(scenarios[0].responses)
  })

  it('rejects extra requests and reports unconsumed scenarios', () => {
    const queue = new AgentRequestResponseQueue(scenarios)

    expect(() => queue.assertComplete()).toThrow(
      'Agent request queue has 2 unconsumed scenarios'
    )
    queue.take(scenarios[0].request)
    queue.take(scenarios[1].request)
    expect(() => queue.take({ content: 'Unexpected request' })).toThrow(
      'Unexpected agent request 3: no scenarios remain'
    )
  })
})
