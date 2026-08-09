import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'

import type { LGraph } from '../LGraph'
import type { LGraphNode } from '../LGraphNode'
import type { INodeInputSlot } from '../interfaces'
import { replaceLinkEndpoints } from '../linkReplacement'
import { slotFloatingLinks } from '../LLink'
import type { LLink } from '../LLink'
import { NodeSlotType } from '../types/globalEnums'
/**
 * Store-backed reads over the links attached to a node's slots.
 * These replace the `output.links[]` / `input.link` mirrors: the link
 * store is the source of truth, and floating links are never included.
 */

/** True when a link targets the input slot. */
export function inputHasLink(
  graph: Pick<LGraph, 'rootGraph' | 'id'>,
  nodeId: NodeId,
  slot: number
): boolean {
  return useLinkStore().isInputSlotConnected(graphScopeOf(graph), nodeId, slot)
}

/** Id of the link targeting an input slot, if any. */
export function inputLinkId(
  graph: Pick<LGraph, 'rootGraph' | 'id'>,
  nodeId: NodeId,
  slot: number
): LinkId | undefined {
  return useLinkStore().getInputSlotLink(graphScopeOf(graph), nodeId, slot)?.id
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
  graph: Pick<LGraph, 'rootGraph' | 'id'>,
  nodeId: NodeId,
  slot: number
): boolean {
  return useLinkStore().isOutputSlotConnected(graphScopeOf(graph), nodeId, slot)
}

/** Ids of the links leaving an output slot, in ascending id order. */
export function outputLinkIds(
  graph: Pick<LGraph, 'rootGraph' | 'id'>,
  nodeId: NodeId,
  slot: number
): LinkId[] {
  const ids = [
    ...useLinkStore().getOutputSlotLinks(graphScopeOf(graph), nodeId, slot)
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

export interface InputLayoutSnapshot {
  inputs: readonly INodeInputSlot[]
  links: ReadonlyMap<INodeInputSlot, LLink>
}

interface InputReplacement {
  input: INodeInputSlot
  link: LLink
  slot: number
}

function finalizeInputLinkRemoval(
  node: LGraphNode,
  input: INodeInputSlot,
  slot: number,
  link: LLink,
  keepReroutes: boolean
): void {
  const graph = node.graph
  if (!graph) return
  const connection = link.resolve(graph)
  for (const floatingLink of slotFloatingLinks(graph, 'input', node.id, slot)) {
    graph.removeFloatingLink(floatingLink)
  }
  if (connection.subgraphInput && 'inputNode' in graph) {
    graph.inputNode._disconnectNodeInput(node, input, link)
    node.onConnectionsChange?.(
      NodeSlotType.INPUT,
      slot,
      false,
      link,
      connection.subgraphInput
    )
    return
  }

  link.disconnect(graph, keepReroutes ? 'output' : undefined)
  graph.incrementVersion()
  node.onConnectionsChange?.(NodeSlotType.INPUT, slot, false, link, input)
  if (connection.outputNode && connection.output) {
    connection.outputNode.onConnectionsChange?.(
      NodeSlotType.OUTPUT,
      link.origin_slot,
      false,
      link,
      connection.output
    )
  }
}
export function captureInputLayout(node: LGraphNode): InputLayoutSnapshot {
  const links = new Map<INodeInputSlot, LLink>()
  if (node.graph) {
    for (const [slot, input] of node.inputs.entries()) {
      const link = inputLink(node.graph, node.id, slot)
      if (link) links.set(input, link)
    }
  }
  return { inputs: [...node.inputs], links }
}

export function replaceNodeInputs(
  node: LGraphNode,
  previous: InputLayoutSnapshot,
  finalInputs: readonly INodeInputSlot[],
  assignments: ReadonlyMap<INodeInputSlot, LLink> = previous.links,
  keepReroutes = false
): InputReplacement[] {
  if (
    node.inputs.length !== previous.inputs.length ||
    node.inputs.some((input, slot) => input !== previous.inputs[slot])
  ) {
    throw new Error('Input layout changed after it was captured')
  }
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
  const removals = previous.inputs.flatMap((input, slot) => {
    const link = previous.links.get(input)
    return link && !retainedLinks.has(link) ? [{ link, slot }] : []
  })

  if (node.graph) {
    const movedAssignments = finalAssignments.filter(
      ({ link, slot }) =>
        link.target_id !== node.id || link.target_slot !== slot
    )
    let replacements: LLink[]
    try {
      replacements = replaceLinkEndpoints(
        node.graph,
        movedAssignments.map(({ link, slot }) => ({
          link,
          endpoints: {
            originId: link.origin_id,
            originSlot: link.origin_slot,
            targetId: node.id,
            targetSlot: slot
          }
        })),
        removals.map(({ link }) => link)
      )
    } catch (error) {
      console.error('Failed to replace node inputs', error)
      return []
    }
    const replacementByOld = new Map(
      movedAssignments.map(({ link }, index) => [link, replacements[index]])
    )
    for (const assignment of finalAssignments) {
      assignment.link = replacementByOld.get(assignment.link) ?? assignment.link
    }
    node.inputs.splice(0, node.inputs.length, ...finalInputs)
    for (const { link, slot } of removals.toReversed()) {
      finalizeInputLinkRemoval(
        node,
        previous.inputs[slot],
        slot,
        link,
        keepReroutes
      )
    }
  } else if (finalAssignments.length) {
    throw new Error('Cannot assign input links to a node without a graph')
  } else {
    node.inputs.splice(0, node.inputs.length, ...finalInputs)
  }

  const oldInputs = new Set(previous.inputs)
  return finalAssignments.filter(({ input }) => !oldInputs.has(input))
}
