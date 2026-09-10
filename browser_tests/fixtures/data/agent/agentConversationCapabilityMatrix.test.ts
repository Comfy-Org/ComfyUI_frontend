// @vitest-environment node
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { zSeedFixture } from '@e2e/../scripts/agentConversationAssemble'
import type { AgentConversation } from '@e2e/fixtures/data/agent/agentConversation'
import {
  listRecordedConversations,
  loadAgentConversation
} from '@e2e/fixtures/data/agent/agentConversation'
import { agentConversationCapabilityMatrix } from '@e2e/fixtures/data/agent/agentConversationCapabilityMatrix'

const supported = agentConversationCapabilityMatrix.filter(
  (row) => row.status === 'supported'
)

const events = (conversation: AgentConversation) =>
  conversation.turns.flatMap((turn) =>
    turn.response.flatMap((entry) =>
      entry.kind === 'event' ? [entry.event] : []
    )
  )
const hasEvent = (conversation: AgentConversation, type: string) =>
  events(conversation).some((event) => event.type === type)
const hasOp = (conversation: AgentConversation, op: string) =>
  conversation.turns.some((turn) =>
    turn.response.some(
      (entry) =>
        entry.kind === 'graph_ops' && entry.ops.some((entry) => entry.op === op)
    )
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

  // What a recording must contain to count for a capability, read from its
  // own events and operations, so a row cannot claim a recording that shows
  // something else.
  const shows: Record<string, (conversation: AgentConversation) => boolean> = {
    add_node: (c) => hasOp(c, 'add_node'),
    connect: (c) => hasOp(c, 'connect'),
    set_widget: (c) => hasOp(c, 'set_widget'),
    delete_node: (c) => hasOp(c, 'delete_node'),
    clear: (c) => hasOp(c, 'clear'),
    agent_thinking: (c) => hasEvent(c, 'agent_thinking'),
    agent_tool_call: (c) => hasEvent(c, 'agent_tool_call'),
    agent_message_delta: (c) => hasEvent(c, 'agent_message_delta'),
    agent_message_done: (c) => hasEvent(c, 'agent_message_done'),
    agent_active_tab: (c) => hasEvent(c, 'agent_active_tab'),
    tool_error: (c) =>
      events(c).some(
        (event) =>
          event.type === 'agent_tool_call' && event.data.status === 'error'
      ),
    clarifying_question: (c) =>
      c.turns.length > 1 &&
      !c.turns[0].response.some((entry) => entry.kind === 'graph_ops'),
    cancelled_turn: (c) =>
      c.turns.some((turn) => turn.cancel_after !== undefined),
    multi_turn_dependent_edit: (c) =>
      c.turns
        .slice(1)
        .some((turn) =>
          turn.response.some((entry) => entry.kind === 'graph_ops')
        ),
    asset_url_in_reply_text: (c) =>
      events(c).some(
        (event) =>
          event.type === 'agent_message_delta' &&
          /https?:\/\//.test(event.data.delta)
      )
  }

  it('names only recordings that show the capability they are listed under', () => {
    const missing = supported.flatMap((row) =>
      row.recordings
        .filter(
          (caseId) => !shows[row.capability]?.(loadAgentConversation(caseId))
        )
        .map((caseId) => `${row.capability}: ${caseId}`)
    )
    expect(missing).toEqual([])
    expect(Object.keys(shows).sort()).toEqual(
      supported.map((row) => row.capability).sort()
    )
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
      'promoted_subgraph_widget',
      'subgraph_internals'
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
        capability: 'reset_doc',
        status: 'blocked',
        reason: 'deferred-by-op-vocabulary'
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
        reason: 'recording-not-yet-captured'
      },
      {
        capability: 'agent_ask_resolved',
        status: 'recordable',
        reason: 'recording-not-yet-captured'
      },
      {
        capability: 'promoted_subgraph_widget',
        status: 'recordable',
        reason: 'recording-not-yet-captured'
      }
    ])
    expect(
      agentConversationCapabilityMatrix.filter(
        (row) => row.status === 'out_of_scope'
      )
    ).toEqual([
      {
        capability: 'subgraph_internals',
        status: 'out_of_scope',
        reason: 'decided 2026-09-04: internals are not part of the suite.'
      }
    ])
  })

  it('derives the empty workflow seed from the recorded clear workflow', () => {
    const seedFixtureUrl = new URL(
      './agent-seed-empty-workflow.json',
      import.meta.url
    )
    const seedFixture = zSeedFixture.parse(
      JSON.parse(readFileSync(seedFixtureUrl, 'utf-8')) as unknown
    )
    const sourceWorkflow = loadAgentConversation(
      'agent-rec-clear-workflow'
    ).workflow

    expect(seedFixtureUrl.pathname).not.toContain('/conversations/')
    expect(seedFixture.workflow).toEqual({
      ...sourceWorkflow,
      name: 'Empty workflow'
    })
    expect(seedFixture.workflow.catalog.types).toEqual(
      sourceWorkflow.catalog.types
    )
    expect(seedFixture.workflow.seed).toEqual({ nodes: [], links: [] })

    const unwrapped = zSeedFixture.safeParse(seedFixture.workflow)
    expect(unwrapped.success).toBe(false)
    if (!unwrapped.success)
      expect(unwrapped.error.issues[0]?.path).toEqual(['workflow'])
  })
})
