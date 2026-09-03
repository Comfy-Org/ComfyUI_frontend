import type { GraphSnapshot } from '@comfyorg/comfy-multi-player'

import type { AgentConversation } from '@e2e/fixtures/data/agent/agentConversation'

export interface ExpectedGraphNode {
  id: string
  title: string
  inputs: boolean[]
  outputs: boolean[]
}

interface NodeBody {
  id: number | string
  type: string
  title?: string
  inputs?: Array<{ name: string }>
  outputs?: Array<{ name: string }>
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function seedNodes(conversation: AgentConversation): NodeBody[] {
  return (conversation.workflow.seed as unknown as { nodes: NodeBody[] }).nodes
}

function addedNodes(conversation: AgentConversation): NodeBody[] {
  return conversation.response.flatMap((entry) =>
    entry.kind === 'graph_ops'
      ? entry.ops.flatMap((op) =>
          asRecord(op).op === 'add_node'
            ? [asRecord(asRecord(op).node) as unknown as NodeBody]
            : []
        )
      : []
  )
}

// The doc keeps no titles or slot names; those come from the node bodies the turn started from or added.
export function expectedGraphSnapshot(
  conversation: AgentConversation,
  graph: GraphSnapshot
): ExpectedGraphNode[] {
  const bodies = [...seedNodes(conversation), ...addedNodes(conversation)]
  const byType = new Map(bodies.map((body) => [body.type, body]))
  const byId = new Map(bodies.map((body) => [String(body.id), body]))
  const catalog = conversation.workflow.catalog.types as Record<
    string,
    { widget_order: string[] }
  >
  const links = Object.values(graph.links) as Array<
    [unknown, unknown, number, unknown, number, string]
  >
  return Object.entries(graph.nodes)
    .map(([id, node]) => {
      const type = String(node.type)
      const body = byId.get(id) ?? byType.get(type)
      const widgets = new Set(catalog[type]?.widget_order ?? [])
      return {
        id,
        title: byId.get(id)?.title ?? type,
        // Widget-backed inputs render as widgets, not slot rows.
        inputs: (body?.inputs ?? [])
          .map((slot, index) => ({ name: slot.name, index }))
          .filter(({ name }) => !widgets.has(name))
          .map(({ index }) =>
            links.some((link) => String(link[3]) === id && link[4] === index)
          ),
        outputs: (body?.outputs ?? []).map((_, index) =>
          links.some((link) => String(link[1]) === id && link[2] === index)
        )
      }
    })
    .sort((a, b) => Number(a.id) - Number(b.id))
}

export interface RecordedToolCall {
  name: string
  ok: boolean
}

// The panel starts a new tool group whenever thinking or text interrupts the calls.
export function recordedToolCallGroups(
  conversation: AgentConversation
): RecordedToolCall[][] {
  const groups: RecordedToolCall[][] = []
  let current: RecordedToolCall[] = []
  for (const entry of conversation.response) {
    if (entry.kind !== 'event') continue
    const { type, data } = entry.event
    if (type === 'agent_tool_call') {
      if (data.status !== 'running')
        current.push({
          name: String(data.tool_name),
          ok: data.status === 'success'
        })
      continue
    }
    if (
      (type === 'agent_thinking' || type === 'agent_message_delta') &&
      current.length > 0
    ) {
      groups.push(current)
      current = []
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

const KNOWN_TOOL_LABELS: Record<string, string> = {
  new_tab: 'Opened a new tab',
  switch_tab: 'Switched tabs',
  remember: 'Saved a preference',
  forget: 'Forgot a preference'
}

// Mirrors the label rule in ToolCallCard.vue.
export function toolRowLabel(name: string): string {
  if (Object.hasOwn(KNOWN_TOOL_LABELS, name)) return KNOWN_TOOL_LABELS[name]
  const spaced = name.replaceAll('_', ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export interface RecordedWidgetValue {
  nodeId: string
  widget: string
  value: string | number
}

export function recordedWidgetValues(
  conversation: AgentConversation,
  graph: GraphSnapshot
): RecordedWidgetValue[] {
  return conversation.response.flatMap((entry) =>
    entry.kind === 'graph_ops'
      ? entry.ops.flatMap((rawOp) => {
          const op = asRecord(rawOp)
          const nodeId = String(op.node_id)
          const widget = String(op.widget)
          const value = asRecord(graph.nodes[nodeId]?.widgets)[widget]
          return op.op === 'set_widget' &&
            (typeof value === 'string' || typeof value === 'number')
            ? [{ nodeId, widget, value }]
            : []
        })
      : []
  )
}

export function recordedAddedNodeIds(
  conversation: AgentConversation,
  graph: GraphSnapshot
): string[] {
  return addedNodes(conversation)
    .map((body) => String(body.id))
    .filter((id) => id in graph.nodes)
}

// One update per ops entry plus the subscribe catch-up.
export function expectedUpdateCount(conversation: AgentConversation): number {
  return (
    conversation.response.filter((entry) => entry.kind === 'graph_ops').length +
    1
  )
}
