// @vitest-environment node
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  listRecordedConversations,
  loadAgentConversation,
  zAgentConversationWorkflow
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

  it('lists each required capability once with statuses and reasons intact', () => {
    const capabilities = agentConversationCapabilityMatrix.map(
      (row) => row.capability
    )
    expect(new Set(capabilities).size).toBe(capabilities.length)
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
      'agent_ask_resolved',
      'reset_doc',
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
        capability: 'agent_ask_resolved',
        status: 'blocked',
        reason: 'stack-not-rebased-onto-main'
      },
      {
        capability: 'reset_doc',
        status: 'blocked',
        reason: 'deferred-by-op-vocabulary'
      },
      {
        capability: 'subgraph_operations',
        status: 'blocked',
        scope: 'structural node and link operations',
        reason: 'no-wire-operation-exists'
      }
    ])
    expect(
      agentConversationCapabilityMatrix.filter(
        (row) => row.status === 'recordable'
      )
    ).toEqual([
      {
        capability: 'agent_ask',
        status: 'recordable',
        reason: 'no recording yet'
      }
    ])
  })

  it('derives the empty workflow seed from the recorded clear workflow', () => {
    const seedFixtureUrl = new URL(
      './agent-seed-empty-workflow.json',
      import.meta.url
    )
    const seedWorkflow = zAgentConversationWorkflow.parse(
      JSON.parse(readFileSync(seedFixtureUrl, 'utf-8'))
    )
    const sourceWorkflow = loadAgentConversation(
      'agent-rec-clear-workflow'
    ).workflow

    expect(seedFixtureUrl.pathname).not.toContain('/conversations/')
    expect(seedWorkflow).toEqual({
      ...sourceWorkflow,
      name: 'Empty workflow'
    })
    expect(seedWorkflow.catalog.types).toEqual(sourceWorkflow.catalog.types)
    expect(seedWorkflow.seed).toEqual({ nodes: [], links: [] })
  })
})
