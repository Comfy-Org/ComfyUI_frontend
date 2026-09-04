// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  listRecordedConversations,
  loadAgentConversation
} from '@e2e/fixtures/data/agent/agentConversation'
import { agentConversationCapabilityMatrix } from '@e2e/fixtures/data/agent/agentConversationCapabilityMatrix'

const supported = agentConversationCapabilityMatrix.filter(
  (row) => row.status === 'supported'
)

describe('agentConversationCapabilityMatrix', () => {
  it('names at least one recording for every supported capability', () => {
    expect(
      supported
        .filter((row) => row.recordings.length === 0)
        .map((row) => row.capability)
    ).toEqual([])
  })

  it('resolves every recording through the recorded conversation catalog', () => {
    const catalog = new Set(listRecordedConversations())
    const references = new Set(supported.flatMap((row) => row.recordings))

    expect([...references].filter((caseId) => !catalog.has(caseId))).toEqual([])
    expect([...catalog].filter((caseId) => !references.has(caseId))).toEqual([])

    for (const caseId of references) {
      const conversation = loadAgentConversation(caseId)
      expect(conversation.source.case_id).toBe(caseId)
      expect(conversation.source.response_side).toBe('recorded')
    }
  })

  it('lists each required capability once with the blocked reasons intact', () => {
    const capabilities = agentConversationCapabilityMatrix.map(
      (row) => row.capability
    )
    expect(capabilities).toEqual([
      'add_node',
      'connect',
      'set_widget',
      'delete_node',
      'clear',
      'agent_thinking',
      'agent_tool_call',
      'agent_message_delta',
      'agent_message_done',
      'agent_active_tab',
      'tool_error',
      'clarifying_question',
      'cancelled_turn',
      'multi_turn_dependent_edit',
      'asset_url_in_reply_text',
      'agent_asset',
      'agent_ask',
      'subgraph_operations'
    ])
    expect(
      agentConversationCapabilityMatrix.filter(
        (row) => row.status === 'blocked'
      )
    ).toEqual([
      {
        capability: 'agent_asset',
        status: 'blocked',
        reason: 'panel-does-not-render-event'
      },
      {
        capability: 'agent_ask',
        status: 'blocked',
        reason: 'panel-does-not-render-event'
      },
      {
        capability: 'subgraph_operations',
        status: 'blocked',
        scope: 'structural node and link operations',
        reason: 'no-wire-operation-exists'
      }
    ])
  })
})
