import type { AgentConversation } from '@e2e/fixtures/data/agent/agentConversation'

// Expectations come from the fixture itself, so re-recording a case never needs hand-pinned values.

export interface ExpectedGraphNode {
  id: string
  title: string
  inputs: boolean[]
  outputs: boolean[]
}

interface SeedNode {
  id: number | string
  type: string
  title?: string
  inputs?: Array<{ name: string }>
  outputs?: Array<{ name: string }>
}

interface Link {
  from: string
  fromSlot: number
  to: string
  toSlot: number
}

interface NodeState {
  type: string
  title: string
  inputNames: string[]
  outputNames: string[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function slotNames(node: SeedNode): {
  inputNames: string[]
  outputNames: string[]
} {
  return {
    inputNames: (node.inputs ?? []).map((slot) => slot.name),
    outputNames: (node.outputs ?? []).map((slot) => slot.name)
  }
}

export function expectedGraphSnapshot(
  conversation: AgentConversation
): ExpectedGraphNode[] {
  const seed = conversation.workflow.seed as unknown as {
    nodes: SeedNode[]
    links: Array<[number, number, number, number, number, string]>
  }
  const catalog = conversation.workflow.catalog.types as Record<
    string,
    { widget_order: string[] }
  >
  const nodes = new Map<string, NodeState>()
  const byType = new Map<
    string,
    { inputNames: string[]; outputNames: string[] }
  >()
  for (const node of seed.nodes) {
    const names = slotNames(node)
    nodes.set(String(node.id), {
      type: node.type,
      title: node.title ?? node.type,
      ...names
    })
    byType.set(node.type, names)
  }
  const links = new Map<string, Link>()
  for (const [id, from, fromSlot, to, toSlot] of seed.links) {
    links.set(String(id), {
      from: String(from),
      fromSlot,
      to: String(to),
      toSlot
    })
  }
  const setLink = (id: string, link: Link) => {
    for (const [existingId, existing] of links) {
      if (existing.to === link.to && existing.toSlot === link.toSlot)
        links.delete(existingId)
    }
    links.set(id, link)
  }

  for (const entry of conversation.response) {
    if (entry.kind !== 'graph_ops') continue
    for (const rawOp of entry.ops) {
      const op = asRecord(rawOp)
      switch (op.op) {
        case 'add_node': {
          const node = asRecord(op.node) as unknown as SeedNode
          const own = slotNames(node)
          const fallback = byType.get(node.type)
          nodes.set(String(node.id), {
            type: node.type,
            title: node.title ?? node.type,
            inputNames: own.inputNames.length
              ? own.inputNames
              : (fallback?.inputNames ?? []),
            outputNames: own.outputNames.length
              ? own.outputNames
              : (fallback?.outputNames ?? [])
          })
          break
        }
        case 'delete_node': {
          const id = String(op.node_id)
          nodes.delete(id)
          for (const [linkId, link] of links) {
            if (link.from === id || link.to === id) links.delete(linkId)
          }
          break
        }
        case 'connect':
          setLink(String(op.link_id), {
            from: String(op.from_node),
            fromSlot: Number(op.from_slot),
            to: String(op.to_node),
            toSlot: Number(op.to_slot)
          })
          break
        case 'set_widget':
          break
        default:
          throw new Error(
            `no expectation rule for recorded op ${String(op.op)}`
          )
      }
    }
  }

  const connected = [...links.values()]
  return [...nodes.entries()]
    .map(([id, node]) => {
      const widgets = new Set(catalog[node.type]?.widget_order ?? [])
      return {
        id,
        title: node.title,
        // Widget-backed inputs render as widgets, not slot rows.
        inputs: node.inputNames
          .map((name, slot) => ({ name, slot }))
          .filter(({ name }) => !widgets.has(name))
          .map(({ slot }) =>
            connected.some((link) => link.to === id && link.toSlot === slot)
          ),
        outputs: node.outputNames.map((_, slot) =>
          connected.some((link) => link.from === id && link.fromSlot === slot)
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
  const known = Object.hasOwn(KNOWN_TOOL_LABELS, name)
    ? KNOWN_TOOL_LABELS[name]
    : undefined
  if (known) return known
  const spaced = name.replaceAll('_', ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export interface RecordedWidgetValue {
  nodeId: string
  widget: string
  value: string | number
}

export function recordedWidgetValues(
  conversation: AgentConversation
): RecordedWidgetValue[] {
  const surviving = new Set(
    expectedGraphSnapshot(conversation).map((node) => node.id)
  )
  return conversation.response.flatMap((entry) => {
    if (entry.kind !== 'graph_ops') return []
    return entry.ops.flatMap((rawOp) => {
      const op = asRecord(rawOp)
      if (op.op !== 'set_widget') return []
      const nodeId = String(op.node_id)
      const value = op.value
      if (
        !surviving.has(nodeId) ||
        (typeof value !== 'string' && typeof value !== 'number')
      )
        return []
      return [{ nodeId, widget: String(op.widget), value }]
    })
  })
}

export function recordedAddedNodeIds(
  conversation: AgentConversation
): string[] {
  const surviving = new Set(
    expectedGraphSnapshot(conversation).map((node) => node.id)
  )
  return conversation.response.flatMap((entry) => {
    if (entry.kind !== 'graph_ops') return []
    return entry.ops.flatMap((rawOp) => {
      const op = asRecord(rawOp)
      if (op.op !== 'add_node') return []
      const id = String(asRecord(op.node).id)
      return surviving.has(id) ? [id] : []
    })
  })
}

// One update per ops entry plus the subscribe catch-up.
export function expectedUpdateCount(conversation: AgentConversation): number {
  return (
    conversation.response.filter((entry) => entry.kind === 'graph_ops').length +
    1
  )
}

export function recordedSpanMs(
  conversation: AgentConversation
): number | undefined {
  const offsets = conversation.response.flatMap((entry) =>
    entry.at_ms === undefined ? [] : [entry.at_ms]
  )
  return offsets.length === 0 ? undefined : Math.max(...offsets)
}
