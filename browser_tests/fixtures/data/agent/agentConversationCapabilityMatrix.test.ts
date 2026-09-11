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

type Turn = AgentConversation['turns'][number]

const turnHasGraphOps = (turn: Turn) =>
  turn.response.some((entry) => entry.kind === 'graph_ops')

const graphOps = (turn: Turn): Record<string, unknown>[] =>
  turn.response.flatMap((entry) =>
    entry.kind === 'graph_ops'
      ? entry.ops.map((op) => op as Record<string, unknown>)
      : []
  )

const addedNodeId = (op: Record<string, unknown>): string | undefined => {
  if (op.op !== 'add_node') return undefined
  const node = op.node
  if (typeof node !== 'object' || node === null) return undefined
  const id = (node as Record<string, unknown>).id
  return id === undefined ? undefined : String(id)
}

const referencedNodeIds = (op: Record<string, unknown>): string[] =>
  ['node_id', 'from_node', 'to_node'].flatMap((key) =>
    op[key] === undefined ? [] : [String(op[key])]
  )

/** A later turn's ops reference a node that an earlier turn added. */
const laterTurnReferencesEarlierAddedNode = (
  conversation: AgentConversation
) => {
  const seen = new Set<string>()
  for (const turn of conversation.turns) {
    const ops = graphOps(turn)
    if (ops.some((op) => referencedNodeIds(op).some((id) => seen.has(id)))) {
      return true
    }
    for (const op of ops) {
      const id = addedNodeId(op)
      if (id !== undefined) seen.add(id)
    }
  }
  return false
}

const urlsIn = (text: string): string[] =>
  text.match(/https?:\/\/[^\s)\]]+/g) ?? []

const MEDIA_EXTENSION = /\.(png|jpe?g|gif|webp|mp4|webm|mp3|wav|ogg|glb|obj)$/i

/** Mirrors classifyAssetUrl: a media filename in the query or pathname. */
const isMediaAssetUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    const candidate =
      parsed.searchParams.get('filename') ??
      parsed.pathname.split('/').pop() ??
      ''
    return MEDIA_EXTENSION.test(candidate)
  } catch {
    return false
  }
}

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
    // The agent answered the first prompt with text only and edited the graph
    // on a later turn once the user answered.
    clarifying_question: (c) =>
      !turnHasGraphOps(c.turns[0]) && c.turns.slice(1).some(turnHasGraphOps),
    cancelled_turn: (c) =>
      c.turns.some((turn) => turn.cancel_after !== undefined),
    // A later turn edits the graph and depends on an earlier turn: either it
    // targets a node the earlier turn added, or the earlier turn was the
    // text-only half of a clarifying exchange.
    multi_turn_dependent_edit: (c) =>
      c.turns.slice(1).some(turnHasGraphOps) &&
      (laterTurnReferencesEarlierAddedNode(c) || !turnHasGraphOps(c.turns[0])),
    // The reply text carries a link to a media asset, identified the way the
    // reply renderer does: by a media filename in the query or path.
    asset_url_in_reply_text: (c) =>
      events(c).some(
        (event) =>
          event.type === 'agent_message_delta' &&
          urlsIn(event.data.delta).some(isMediaAssetUrl)
      )
  }

  it('lists under each capability exactly the recordings that show it', () => {
    const catalog = listRecordedConversations().map((caseId) => ({
      caseId,
      conversation: loadAgentConversation(caseId)
    }))
    const listed = Object.fromEntries(
      supported.map((row) => [row.capability, [...row.recordings].sort()])
    )
    const shown = Object.fromEntries(
      supported.map((row) => [
        row.capability,
        catalog
          .filter(({ conversation }) => shows[row.capability]?.(conversation))
          .map(({ caseId }) => caseId)
          .sort()
      ])
    )
    expect(listed).toEqual(shown)
    expect(Object.keys(shows).sort()).toEqual(
      supported.map((row) => row.capability).sort()
    )
  })

  it('lists each capability once', () => {
    const capabilities = agentConversationCapabilityMatrix.map(
      (row) => row.capability
    )
    expect(new Set(capabilities).size).toBe(capabilities.length)
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
