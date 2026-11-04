import type {
  Modality,
  NodeId,
  PortRef,
  PortSpec,
  SuperEdge,
  SuperGraphDocument,
  SuperNode
} from './documentSchema'
import type { ConnectOutcome } from './types'

function outPort(modality: Modality): PortSpec {
  return { name: 'out', label: 'out', modality, required: false, multi: false }
}

function bySeq(a: SuperEdge, b: SuperEdge): number {
  return a.seq - b.seq
}

export function findNode(
  doc: SuperGraphDocument,
  nodeId: NodeId
): SuperNode | undefined {
  return doc.nodes.find((node) => node.id === nodeId)
}

export function portsOf(node: SuperNode): {
  inputs: PortSpec[]
  outputs: PortSpec[]
} {
  switch (node.kind) {
    case 'io':
      return {
        inputs: [
          {
            name: 'in',
            label: 'in',
            modality: node.modality,
            required: false,
            multi: true
          }
        ],
        outputs: [outPort(node.modality)]
      }
    case 'generate':
      return {
        inputs: node.contract?.inputs ?? [],
        outputs: node.contract?.outputs ?? [outPort(node.modality)]
      }
    case 'app':
      return {
        inputs: node.contract?.inputs ?? [],
        outputs: node.contract?.outputs ?? []
      }
  }
}

export function incomingEdges(
  doc: SuperGraphDocument,
  nodeId: NodeId,
  port: string
): SuperEdge[] {
  return doc.edges
    .filter((edge) => edge.to.node === nodeId && edge.to.port === port)
    .sort(bySeq)
}

export function upstreamIds(doc: SuperGraphDocument, nodeId: NodeId): NodeId[] {
  const sources = doc.edges
    .filter((edge) => edge.to.node === nodeId)
    .sort(bySeq)
    .map((edge) => edge.from.node)
  return [...new Set(sources)]
}

export function executionOrder(doc: SuperGraphDocument): {
  order: NodeId[]
  cyclic: NodeId[]
} {
  const ids = doc.nodes.map((node) => node.id)
  const known = new Set(ids)
  const edges = doc.edges
    .filter((edge) => known.has(edge.from.node) && known.has(edge.to.node))
    .sort(bySeq)
  const indegree = new Map<NodeId, number>(ids.map((id) => [id, 0]))
  for (const edge of edges) {
    indegree.set(edge.to.node, (indegree.get(edge.to.node) ?? 0) + 1)
  }
  const order = ids.filter((id) => indegree.get(id) === 0)
  for (let cursor = 0; cursor < order.length; cursor++) {
    for (const edge of edges) {
      if (edge.from.node !== order[cursor]) continue
      const remaining = (indegree.get(edge.to.node) ?? 0) - 1
      indegree.set(edge.to.node, remaining)
      if (remaining === 0) order.push(edge.to.node)
    }
  }
  const ordered = new Set(order)
  return { order, cyclic: ids.filter((id) => !ordered.has(id)) }
}

function wouldCreateCycle(
  doc: SuperGraphDocument,
  from: NodeId,
  to: NodeId
): boolean {
  const reached = new Set<NodeId>([to])
  const frontier = [to]
  for (let cursor = 0; cursor < frontier.length; cursor++) {
    if (frontier[cursor] === from) return true
    for (const edge of doc.edges) {
      if (edge.from.node !== frontier[cursor] || reached.has(edge.to.node))
        continue
      reached.add(edge.to.node)
      frontier.push(edge.to.node)
    }
  }
  return false
}

function resolvePort(
  node: SuperNode,
  name: string,
  side: 'inputs' | 'outputs'
): PortSpec | 'direction' | 'unknownPort' {
  const ports = portsOf(node)
  const other = side === 'inputs' ? 'outputs' : 'inputs'
  const found = ports[side].find((port) => port.name === name)
  if (found) return found
  return ports[other].some((port) => port.name === name)
    ? 'direction'
    : 'unknownPort'
}

export function canConnect(
  doc: SuperGraphDocument,
  from: PortRef,
  to: PortRef
): ConnectOutcome {
  if (from.node === to.node) return { ok: false, reason: 'self' }
  const source = findNode(doc, from.node)
  const target = findNode(doc, to.node)
  if (!source || !target) return { ok: false, reason: 'unknownPort' }
  const output = resolvePort(source, from.port, 'outputs')
  if (typeof output === 'string') return { ok: false, reason: output }
  const input = resolvePort(target, to.port, 'inputs')
  if (typeof input === 'string') return { ok: false, reason: input }
  if (output.modality !== input.modality) {
    return { ok: false, reason: 'modality' }
  }
  const existing = incomingEdges(doc, to.node, to.port)
  if (
    existing.some(
      (edge) => edge.from.node === from.node && edge.from.port === from.port
    )
  ) {
    return { ok: false, reason: 'duplicate' }
  }
  if (wouldCreateCycle(doc, from.node, to.node)) {
    return { ok: false, reason: 'cycle' }
  }
  if (!input.multi && existing.length > 0) {
    return { ok: true, replaces: existing[0].id }
  }
  if (input.max !== undefined && existing.length >= input.max) {
    return { ok: false, reason: 'full' }
  }
  return { ok: true }
}

export function ioChainDownstream(
  doc: SuperGraphDocument,
  nodeId: NodeId
): NodeId[] {
  const reached = new Set<NodeId>()
  const frontier = [nodeId]
  for (let cursor = 0; cursor < frontier.length; cursor++) {
    for (const edge of doc.edges) {
      if (edge.from.node !== frontier[cursor] || reached.has(edge.to.node))
        continue
      if (findNode(doc, edge.to.node)?.kind !== 'io') continue
      reached.add(edge.to.node)
      frontier.push(edge.to.node)
    }
  }
  return executionOrder(doc).order.filter((id) => reached.has(id))
}
