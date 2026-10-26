import { z } from 'zod'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { isSubgraph } from '@/lib/litegraph/src/subgraph/subgraphTypeGuards'
import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'

import { resolveSlotRef, slotIdOf } from './slotRef'
import type { SlotRef } from './slotRef'

export interface ConnectionRule {
  readonly side: 'input' | 'output'
  readonly slots?: readonly SlotRef[]
  readonly peerTypes?: readonly string[]
  readonly peerSlots?: readonly SlotRef[]
  readonly allow: 'only' | 'never'
  readonly whileDownstream?: readonly string[]
  readonly requiresConnectedInputs?: readonly SlotRef[]
}

export interface ConnectionPolicy {
  readonly passThroughTypes?: readonly string[]
  readonly refuseCycles?: boolean
  readonly refuseDuplicateSources?: boolean
  readonly rules?: readonly ConnectionRule[]
}

const boundedText = z.string().min(1).max(128)
const slotReference = z.union([
  boundedText,
  z
    .object({ index: z.number().int().min(0).max(65535) })
    .strict()
    .readonly()
])
const slotReferences = z.array(slotReference).min(1).max(32).readonly()
const nodeTypes = z.array(boundedText).min(1).max(32).readonly()
const connectionRule = z
  .object({
    side: z.enum(['input', 'output']),
    slots: slotReferences.optional(),
    peerTypes: nodeTypes.optional(),
    peerSlots: slotReferences.optional(),
    allow: z.enum(['only', 'never']),
    whileDownstream: nodeTypes.optional(),
    requiresConnectedInputs: slotReferences.optional()
  })
  .strict()
  .readonly()
const connectionPolicy = z
  .object({
    passThroughTypes: z.array(boundedText).max(8).readonly().optional(),
    refuseCycles: z.boolean().optional(),
    refuseDuplicateSources: z.boolean().optional(),
    rules: z.array(connectionRule).max(16).readonly().optional()
  })
  .strict()
  .readonly()

export function parseConnectionPolicy(value: unknown) {
  try {
    return connectionPolicy.safeParse(value)
  } catch (error) {
    return { success: false, error } as const
  }
}

type Side = ConnectionRule['side']
type Slots = LGraphNode['inputs'] | LGraphNode['outputs']
type Budget = { remaining: number }

interface ConnectionAttempt {
  node: LGraphNode
  peer: unknown
  side: Side
  index: number
  peerIndex: number | undefined
  peerSlot: unknown
}

interface PeerEndpoint {
  id: NodeId
  type?: string
  slots: Slots
  index: number
  node?: LGraphNode
}

interface Neighbourhood {
  nodes: LGraphNode[]
  sources: Set<string>
}

function nodePeer(
  graph: LGraph,
  peer: LGraphNode,
  attempt: ConnectionAttempt
): PeerEndpoint | undefined {
  const slots = attempt.side === 'input' ? peer.outputs : peer.inputs
  const index = attempt.peerIndex
  if (
    peer.graph !== graph ||
    graph.getNodeById(peer.id) !== peer ||
    index === undefined ||
    slots[index] !== attempt.peerSlot
  )
    return undefined
  return { id: peer.id, type: peer.type, slots, index, node: peer }
}

function peerEndpoint(
  graph: LGraph,
  attempt: ConnectionAttempt,
  budget: Budget
): PeerEndpoint | undefined {
  const { peer, side, peerSlot } = attempt
  if (peer instanceof LGraphNode) return nodePeer(graph, peer, attempt)
  if (!isSubgraph(graph)) return undefined
  const io = side === 'input' ? graph.inputNode : graph.outputNode
  if (io !== peer) return undefined
  budget.remaining -= io.slots.length
  if (budget.remaining < 0) return undefined
  const index = io.slots.findIndex((slot) => slot === peerSlot)
  if (index < 0) return undefined
  return { id: io.id, slots: io.slots, index }
}

function slotIndex(
  slots: Slots,
  reference: SlotRef,
  budget: Budget
): number | undefined {
  budget.remaining -= slots.length * 2
  if (budget.remaining < 0) return undefined
  try {
    const index = resolveSlotRef(slots, reference)
    return index < 0 ? undefined : index
  } catch {
    return undefined
  }
}

function selectedSlot(
  slots: Slots,
  references: readonly SlotRef[] | undefined,
  index: number,
  budget: Budget
): boolean | undefined {
  if (!references) return true
  let selected = false
  for (const reference of references) {
    const resolved = slotIndex(slots, reference, budget)
    if (resolved === undefined) return undefined
    if (resolved === index) selected = true
  }
  return selected
}

function boundarySource(
  graph: LGraph,
  sourceId: NodeId,
  sourceSlot: number
): string | undefined {
  if (!isSubgraph(graph) || sourceId !== graph.inputNode.id) return undefined
  const slot = extensionValue(graph.inputNode.slots[sourceSlot])
  return slot ? JSON.stringify([graph.id, 'input', slotIdOf(slot)]) : undefined
}

function connectedLinks(
  graph: LGraph,
  node: LGraphNode,
  side: Side,
  index: number
) {
  const store = useLinkStore()
  const scope = graphScopeOf(graph)
  if (side === 'output') return store.getOutputSlotLinks(scope, node.id, index)
  const incoming = store.getInputSlotLink(scope, node.id, index)
  return incoming ? [incoming] : []
}

function collectNeighbour(
  graph: LGraph,
  side: Side,
  peerId: NodeId,
  sourceSlot: number,
  result: Neighbourhood
): void {
  const peer = extensionValue(graph.getNodeById(peerId))
  if (peer?.graph === graph) {
    result.nodes.push(peer)
    return
  }
  if (side !== 'input') return
  const source = boundarySource(graph, peerId, sourceSlot)
  if (source) result.sources.add(source)
}

function neighbours(
  graph: LGraph,
  node: LGraphNode,
  side: Side,
  budget: Budget
): Neighbourhood | undefined {
  const slots = side === 'input' ? node.inputs : node.outputs
  const result: Neighbourhood = { nodes: [], sources: new Set() }
  for (let index = 0; index < slots.length; index++) {
    if (--budget.remaining < 0) return undefined
    for (const link of connectedLinks(graph, node, side, index)) {
      if (--budget.remaining < 0) return undefined
      collectNeighbour(
        graph,
        side,
        side === 'input' ? link.originNodeId : link.targetNodeId,
        link.originSlot,
        result
      )
    }
  }
  return result
}

function traversalFrontier(
  graph: LGraph,
  node: LGraphNode,
  side: Side,
  through: readonly string[] | undefined,
  budget: Budget
): Neighbourhood | undefined {
  const source = JSON.stringify([graph.id, 'node', node.id])
  if (through && !through.includes(node.type)) {
    return { nodes: [], sources: new Set([source]) }
  }
  const next = neighbours(graph, node, side, budget)
  if (next && next.nodes.length === 0 && next.sources.size === 0) {
    next.sources.add(source)
  }
  return next
}

function walk(
  graph: LGraph,
  seeds: readonly LGraphNode[],
  side: Side,
  through: readonly string[] | undefined,
  budget: Budget
): { reached: Set<LGraphNode>; sources: Set<string> } | undefined {
  const queue = [...seeds]
  const reached = new Set<LGraphNode>()
  const sources = new Set<string>()
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index]
    if (reached.has(node)) continue
    if (--budget.remaining < 0) return undefined
    reached.add(node)
    const next = traversalFrontier(graph, node, side, through, budget)
    if (!next) return undefined
    for (const source of next.sources) sources.add(source)
    queue.push(...next.nodes)
  }
  return { reached, sources }
}

function sourceIdentities(
  graph: LGraph,
  sourceId: NodeId,
  sourceSlot: number,
  policy: ConnectionPolicy,
  budget: Budget
): Set<string> | undefined {
  const source = extensionValue(graph.getNodeById(sourceId))
  if (!source) {
    const boundary = boundarySource(graph, sourceId, sourceSlot)
    return boundary ? new Set([boundary]) : undefined
  }
  const found = walk(
    graph,
    [source],
    'input',
    policy.passThroughTypes ?? [],
    budget
  )
  return found?.sources.size ? found.sources : undefined
}

function hasDuplicateSource(
  graph: LGraph,
  node: LGraphNode,
  peer: PeerEndpoint,
  inputIndex: number,
  policy: ConnectionPolicy,
  budget: Budget
): boolean {
  const proposed = sourceIdentities(graph, peer.id, peer.index, policy, budget)
  if (!proposed) return true
  const store = useLinkStore()
  const scope = graphScopeOf(graph)
  for (let index = 0; index < node.inputs.length; index++) {
    if (--budget.remaining < 0) return true
    if (index === inputIndex) continue
    const link = store.getInputSlotLink(scope, node.id, index)
    if (!link) continue
    const existing = sourceIdentities(
      graph,
      link.originNodeId,
      link.originSlot,
      policy,
      budget
    )
    if (!existing) return true
    if ([...existing].some((value) => proposed.has(value))) {
      return true
    }
  }
  return false
}

function downstreamMatches(
  graph: LGraph,
  node: LGraphNode,
  types: readonly string[] | undefined,
  policy: ConnectionPolicy,
  budget: Budget
): boolean | undefined {
  if (!types) return true
  const seeds = neighbours(graph, node, 'output', budget)
  if (!seeds) return undefined
  const found = walk(
    graph,
    seeds.nodes,
    'output',
    policy.passThroughTypes ?? [],
    budget
  )
  return found && [...found.reached].some((value) => types.includes(value.type))
}

function inputsConnected(
  graph: LGraph,
  node: LGraphNode,
  references: readonly SlotRef[] | undefined,
  budget: Budget
): boolean | undefined {
  const store = useLinkStore()
  const scope = graphScopeOf(graph)
  const requiredInputs =
    references?.map((reference) => slotIndex(node.inputs, reference, budget)) ??
    []
  if (requiredInputs.some((input) => input === undefined)) return undefined
  return requiredInputs.every(
    (input) =>
      input !== undefined && store.isInputSlotConnected(scope, node.id, input)
  )
}

function peerMatches(
  rule: ConnectionRule,
  graph: LGraph,
  node: LGraphNode,
  peer: PeerEndpoint,
  budget: Budget
): boolean | undefined {
  const selected = selectedSlot(peer.slots, rule.peerSlots, peer.index, budget)
  if (selected === undefined) return undefined
  const connected = inputsConnected(
    graph,
    node,
    rule.requiresConnectedInputs,
    budget
  )
  if (connected === undefined) return undefined
  return (
    selected &&
    connected &&
    (!rule.peerTypes || rule.peerTypes.includes(peer.type ?? ''))
  )
}

function ruleAllows(
  rule: ConnectionRule,
  graph: LGraph,
  node: LGraphNode,
  peer: PeerEndpoint,
  side: Side,
  index: number,
  policy: ConnectionPolicy,
  budget: Budget
): boolean {
  if (rule.side !== side) return true
  const selected = selectedSlot(
    side === 'input' ? node.inputs : node.outputs,
    rule.slots,
    index,
    budget
  )
  if (selected === undefined) return false
  if (!selected) return true
  const downstream = downstreamMatches(
    graph,
    node,
    rule.whileDownstream,
    policy,
    budget
  )
  if (downstream === undefined) return false
  if (!downstream) return true
  const matches = peerMatches(rule, graph, node, peer, budget)
  if (matches === undefined) return false
  return rule.allow === 'only' ? matches : !matches
}

function cycleAllows(
  graph: LGraph,
  node: LGraphNode,
  peer: PeerEndpoint,
  side: Side,
  policy: ConnectionPolicy,
  budget: Budget
): boolean {
  if (!policy.refuseCycles) return true
  const reverse = side === 'input' ? 'output' : 'input'
  const seeds = neighbours(graph, node, reverse, budget)
  if (!seeds) return false
  const existing = walk(
    graph,
    seeds.nodes,
    reverse,
    policy.passThroughTypes,
    budget
  )
  if (!existing) return false
  return !peer.node || !existing.reached.has(peer.node)
}

function topologyAllows(
  graph: LGraph,
  node: LGraphNode,
  peer: PeerEndpoint,
  side: Side,
  index: number,
  policy: ConnectionPolicy,
  budget: Budget
): boolean {
  if (!cycleAllows(graph, node, peer, side, policy, budget)) return false
  if (side !== 'input' || !policy.refuseDuplicateSources) return true
  return !hasDuplicateSource(graph, node, peer, index, policy, budget)
}

export function connectionPolicyAllows(
  policy: ConnectionPolicy,
  attempt: ConnectionAttempt
): boolean {
  const { node, side, index } = attempt
  const graph = node.graph
  if (!graph || graph.getNodeById(node.id) !== node) return false
  const budget = { remaining: 4096 }
  const peer = peerEndpoint(graph, attempt, budget)
  if (!peer) return false
  const slots = side === 'input' ? node.inputs : node.outputs
  if (!slots[index] || !peer.slots[peer.index]) return false
  if (!topologyAllows(graph, node, peer, side, index, policy, budget))
    return false
  if (!policy.rules) return true
  return policy.rules.every((rule) =>
    ruleAllows(rule, graph, node, peer, side, index, policy, budget)
  )
}
