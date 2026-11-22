import { reportError } from '@comfyorg/telemetry/reportError'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { emitGraphIntent } from '@/lib/litegraph/src/graphIntents'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { LLink, slotFloatingLinks } from '@/lib/litegraph/src/LLink'
import { inputLink, outputLinks } from '@/lib/litegraph/src/node/slotLinks'
import { useLinkStore } from '@/stores/linkStore'
import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { LinkTopology } from '@comfyorg/graph-model/linkTopology'

export type RerouteNodeSkipReason =
  | 'bypassed'
  | 'locked'
  | 'floatingLink'
  | 'noInput'
  | 'noOutput'
  | 'cycle'
  | 'subgraphIO'
  | 'virtualSource'
  | 'typeMismatch'

export interface RerouteNodeConversionPlan {
  convertible: LGraphNode[]
  skipped: { node: LGraphNode; reason: RerouteNodeSkipReason }[]
}

export function isRerouteNode(node: LGraphNode): boolean {
  return node.type === 'Reroute'
}

function upstreamSource(
  graph: LGraph,
  start: LGraphNode
):
  | { ok: true; node: LGraphNode; slot: number }
  | { ok: false; reason: RerouteNodeSkipReason } {
  const visited = new Set<LGraphNode>()
  let node = start
  while (isRerouteNode(node)) {
    if (visited.has(node)) return { ok: false, reason: 'cycle' }
    visited.add(node)
    const link = inputLink(graph, node.id, 0)
    if (!link) return { ok: false, reason: 'noInput' }
    if (link.origin_id === SUBGRAPH_INPUT_ID)
      return { ok: false, reason: 'subgraphIO' }
    const origin = graph.getNodeById(link.origin_id)
    if (!origin) return { ok: false, reason: 'noInput' }
    if (!isRerouteNode(origin)) {
      if (origin.isVirtualNode) return { ok: false, reason: 'virtualSource' }
      return { ok: true, node: origin, slot: link.origin_slot }
    }
    node = origin
  }
  return { ok: false, reason: 'noInput' }
}

function skipReason(
  graph: LGraph,
  node: LGraphNode
): RerouteNodeSkipReason | undefined {
  if (node.mode !== LGraphEventMode.ALWAYS) return 'bypassed'
  if (node.removable === false || node.block_delete || node.ignore_remove)
    return 'locked'
  if (
    slotFloatingLinks(graph, 'input', node.id, 0).length ||
    slotFloatingLinks(graph, 'output', node.id, 0).length
  )
    return 'floatingLink'
  const outputs = outputLinks(graph, node.id, 0)
  if (!outputs.length) return 'noOutput'
  if (outputs.some((link) => link.target_id === SUBGRAPH_OUTPUT_ID))
    return 'subgraphIO'

  const source = upstreamSource(graph, node)
  if (!source.ok) return source.reason
  const sourceType = source.node.outputs.at(source.slot)?.type
  const typesMatch = outputs.every((link) => {
    const target = graph.getNodeById(link.target_id)
    if (!target) return false
    if (isRerouteNode(target)) return true
    const input = target.inputs.at(link.target_slot)
    return (
      !!input &&
      sourceType !== undefined &&
      LiteGraph.isValidConnection(sourceType, input.type)
    )
  })
  return typesMatch ? undefined : 'typeMismatch'
}

/** Splits Reroute nodes into those that can become link reroutes and those left as nodes, with the reason. */
export function planRerouteNodeConversion(
  graph: LGraph,
  nodes: Iterable<LGraphNode>
): RerouteNodeConversionPlan {
  const plan: RerouteNodeConversionPlan = { convertible: [], skipped: [] }
  for (const node of nodes) {
    if (!isRerouteNode(node) || node.graph !== graph) continue
    const reason = skipReason(graph, node)
    if (reason) plan.skipped.push({ node, reason })
    else plan.convertible.push(node)
  }
  return plan
}

function announceSplice(
  graph: LGraph,
  input: LLink,
  outputs: readonly LLink[]
): void {
  for (const link of outputs) {
    emitGraphIntent({ type: 'disconnect', graph, link })
    emitGraphIntent({ type: 'connect', graph, link })
  }
  emitGraphIntent({ type: 'disconnect', graph, link: input })
}

function notifySplicedConnections(
  graph: LGraph,
  input: LLink,
  outputs: readonly LLink[]
): void {
  const source = graph.getNodeById(input.origin_id)
  for (const link of outputs) {
    const target = graph.getNodeById(link.target_id)
    try {
      source?.onConnectionsChange?.(
        NodeSlotType.OUTPUT,
        link.origin_slot,
        true,
        link,
        source.outputs[link.origin_slot]
      )
      target?.onConnectionsChange?.(
        NodeSlotType.INPUT,
        link.target_slot,
        true,
        link,
        target.inputs[link.target_slot]
      )
    } catch (error) {
      reportError(error, {
        surface: 'graph',
        errorType: 'failure_notifying_reroute_conversion'
      })
    }
  }
}

function convertRerouteNode(graph: LGraph, node: LGraphNode): boolean {
  if (node.graph !== graph || skipReason(graph, node)) return false
  const input = inputLink(graph, node.id, 0)
  const outputs = outputLinks(graph, node.id, 0)
  if (!input) return false

  const linkStore = useLinkStore()
  const scope = graphScopeOf(graph)
  const topologyOf = (link: LLink) =>
    linkStore.getTopology(scope.rootGraphId, link.id)
  const inputTopology = topologyOf(input)
  const updates = outputs.flatMap((link) => {
    const topology = topologyOf(link)
    return topology
      ? [
          {
            topology,
            patch: {
              originNodeId: input.origin_id,
              originSlot: input.origin_slot
            }
          }
        ]
      : []
  })
  if (!inputTopology || updates.length !== outputs.length) return false
  const removals: LinkTopology[] = [inputTopology]
  if (linkStore.validateEndpointUpdates(scope, updates, removals)) return false

  const reroute = graph.setReroute({
    parentId: input.parentId,
    pos: [node.pos[0] + node.size[0] / 2, node.pos[1] + node.size[1] / 2],
    linkIds: []
  })
  if (!reroute) return false
  for (const link of outputs) {
    const first = LLink.getFirstReroute(graph, link)
    if (first) first.parentId = reroute.id
    else link.parentId = reroute.id
  }

  const result = linkStore.updateEndpoints(scope, updates, removals)
  if (!result.ok) {
    reportError(result.error, {
      surface: 'graph',
      errorType: 'failure_converting_reroute_node'
    })
    return false
  }
  announceSplice(graph, input, outputs)
  input.disconnect(graph)
  graph.remove(node)
  graph.incrementVersion()
  notifySplicedConnections(graph, input, outputs)
  return true
}

/** Replaces each still-eligible Reroute node with a link reroute at its centre; returns how many were converted. */
export function convertRerouteNodes(
  graph: LGraph,
  nodes: readonly LGraphNode[]
): number {
  let converted = 0
  for (const node of nodes) {
    if (convertRerouteNode(graph, node)) converted++
  }
  if (converted) graph.setDirtyCanvas(true, true)
  return converted
}
