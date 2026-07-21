import { useLinkStore } from '@/stores/linkStore'
import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'

import type { LGraph } from '../LGraph'
import type { LGraphNode } from '../LGraphNode'
import type { INodeInputSlot } from '../interfaces'
import type { LLink } from '../LLink'

/**
 * Store-backed reads over the links attached to a node's slots.
 * These replace the `output.links[]` / `input.link` mirrors: the link
 * store is the source of truth, and floating links are never included.
 */

/** True when a link targets the input slot. */
export function inputHasLink(
  graph: Pick<LGraph, 'rootGraph'>,
  nodeId: NodeId,
  slot: number
): boolean {
  return useLinkStore().isInputSlotConnected(graph.rootGraph.id, nodeId, slot)
}

/** Id of the link targeting an input slot, if any. */
export function inputLinkId(
  graph: Pick<LGraph, 'rootGraph'>,
  nodeId: NodeId,
  slot: number
): LinkId | undefined {
  return useLinkStore().getInputSlotLink(graph.rootGraph.id, nodeId, slot)?.id
}

/** The link targeting an input slot, resolved in the owning graph. */
export function inputLink(
  graph: LGraph,
  nodeId: NodeId,
  slot: number
): LLink | undefined {
  const id = inputLinkId(graph, nodeId, slot)
  return id === undefined ? undefined : graph.getLink(id)
}

/** True when at least one link leaves the output slot. */
export function outputHasLinks(
  graph: Pick<LGraph, 'rootGraph'>,
  nodeId: NodeId,
  slot: number
): boolean {
  return useLinkStore().isOutputSlotConnected(graph.rootGraph.id, nodeId, slot)
}

/** Ids of the links leaving an output slot, in ascending id order. */
export function outputLinkIds(
  graph: Pick<LGraph, 'rootGraph'>,
  nodeId: NodeId,
  slot: number
): LinkId[] {
  const ids = [
    ...useLinkStore().getOutputSlotLinks(graph.rootGraph.id, nodeId, slot)
  ].map((topology) => topology.id)
  return ids.sort((a, b) => a - b)
}

/**
 * Snapshot of the links leaving an output slot, resolved in the owning
 * graph. Safe to disconnect links while iterating the result.
 */
export function outputLinks(
  graph: LGraph,
  nodeId: NodeId,
  slot: number
): LLink[] {
  const links: LLink[] = []
  for (const id of outputLinkIds(graph, nodeId, slot)) {
    const link = graph.getLink(id)
    if (link) links.push(link)
  }
  return links
}

export type InputLinkAssignments = Map<INodeInputSlot, LLink>

export interface InputReplacement {
  input: INodeInputSlot
  link: LLink
  slot: number
}

/** Captures input connectivity by slot identity before an array rebuild. */
export function captureInputLinks(node: LGraphNode): InputLinkAssignments {
  const assignments: InputLinkAssignments = new Map()
  if (!node.graph) return assignments

  for (const [slot, input] of node.inputs.entries()) {
    const link = inputLink(node.graph, node.id, slot)
    if (link) assignments.set(input, link)
  }
  return assignments
}

/**
 * Commits a complete input layout and its retained link assignments.
 * Removed links disconnect while their old slot indices are still valid.
 */
export function replaceNodeInputs(
  node: LGraphNode,
  finalInputs: readonly INodeInputSlot[],
  assignments: ReadonlyMap<INodeInputSlot, LLink>
): InputReplacement[] {
  if (new Set(finalInputs).size !== finalInputs.length) {
    throw new Error('An input slot may only appear once in the final layout')
  }

  const finalAssignments = finalInputs.flatMap((input, slot) => {
    const link = assignments.get(input)
    return link ? [{ input, link, slot }] : []
  })
  if (
    new Set(finalAssignments.map(({ link }) => link)).size !==
    finalAssignments.length
  ) {
    throw new Error('A link may only be assigned to one input slot')
  }

  const retainedLinks = new Set(finalAssignments.map(({ link }) => link))
  if (node.graph) {
    for (let slot = node.inputs.length - 1; slot >= 0; slot--) {
      const link = inputLink(node.graph, node.id, slot)
      if (link && !retainedLinks.has(link)) node.disconnectInput(slot)
    }

    useLinkStore().updateEndpoints(
      node.graph.rootGraph.id,
      finalAssignments.map(({ link, slot }) => ({
        topology: link._state,
        patch: { targetNodeId: node.id, targetSlot: slot }
      }))
    )
  } else if (finalAssignments.length) {
    throw new Error('Cannot assign input links to a node without a graph')
  }

  const oldInputs = new Set(node.inputs)
  node.inputs.splice(0, node.inputs.length, ...finalInputs)
  return finalAssignments.filter(({ input }) => !oldInputs.has(input))
}
