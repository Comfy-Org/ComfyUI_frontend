import { useLinkStore } from '@/stores/linkStore'
import type { EndpointUpdate } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { registerLinkTopology } from './LLink'
import { inputLinkId } from './node/slotLinks'

import type { LGraph } from './LGraph'
import type { LGraphNode } from './LGraphNode'
import type { LLink, LinkId } from './LLink'
import type { ISerialisedNode } from './types/serialisation'

/** Generates a unique string key for a link's connection tuple. */
function linkTupleKey(link: LLink): string {
  return `${link.origin_id}\0${link.origin_slot}\0${link.target_id}\0${link.target_slot}`
}

/** Groups all link IDs by their connection tuple key. */
export function groupLinksByTuple(
  links: Map<LinkId, LLink>
): Map<string, LinkId[]> {
  const groups = new Map<string, LinkId[]>()
  for (const [id, link] of links) {
    const key = linkTupleKey(link)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(id)
  }
  return groups
}

/**
 * Finds the link ID actually referenced by an input on the target node.
 * Cannot rely on target_slot index because widget-to-input conversions
 * during configure() can shift slot indices.
 */
export function selectSurvivorLink(
  ids: LinkId[],
  node: LGraphNode | null
): LinkId {
  if (!node?.graph) return ids[0]

  for (const [index] of (node.inputs ?? []).entries()) {
    const registered = inputLinkId(node.graph, node.id, index)
    if (registered != null && ids.includes(registered)) return registered
  }
  return ids[0]
}

/**
 * Removes duplicate links from origin outputs and the graph, routing map
 * removal through {@link LGraph._removeLink} so the link and layout stores
 * stay in sync.
 */
export function purgeOrphanedLinks(
  ids: LinkId[],
  keepId: LinkId,
  graph: LGraph
): void {
  for (const id of ids) {
    if (id === keepId) continue

    const link = graph._links.get(id)
    if (!link) continue

    graph._removeLink(id)
  }

  // Purging a duplicate that owned the survivor's target-slot index entry
  // removes that entry, so re-assert the survivor's registration afterwards.
  const survivor = graph._links.get(keepId)
  if (survivor) registerLinkTopology(graph, survivor)
}

/**
 * Re-points each link's `target_slot` at the index of the serialized input
 * that references it. Node `configure()` overrides may reorder a node's
 * serialized inputs in place to match the current node definition (e.g.
 * widget-to-input conversions, Comfy-Org/ComfyUI_frontend#3348), invalidating
 * the slot indices stored on links.
 *
 * @param graph The graph whose links to realign
 * @param nodesData The serialized node data the graph's nodes were configured
 * from, after any in-place input reordering by node `configure()` overrides
 * @param survivorByPurged Maps a duplicate link id removed by
 * {@link purgeOrphanedLinks} to the survivor kept in its place, so an input
 * referencing a purged duplicate realigns the surviving link
 */
export function realignInputLinkSlots(
  graph: LGraph,
  nodesData: Iterable<ISerialisedNode>,
  survivorByPurged: ReadonlyMap<LinkId, LinkId> = new Map()
): void {
  const referencedSlots = new Map<LLink, number[]>()

  for (const nodeData of nodesData) {
    for (const [slot, input] of (nodeData.inputs ?? []).entries()) {
      if (input.link == null) continue
      const serializedId = toLinkId(input.link)
      const linkId = survivorByPurged.get(serializedId) ?? serializedId
      const link = graph._links.get(linkId)
      if (!link || link.target_id !== toNodeId(nodeData.id)) continue
      const slots = referencedSlots.get(link) ?? []
      slots.push(slot)
      referencedSlots.set(link, slots)
    }
  }

  const updates: EndpointUpdate[] = []
  for (const [link, slots] of referencedSlots) {
    const slot = slots.includes(link.target_slot) ? link.target_slot : slots[0]
    if (link.target_slot === slot) continue
    updates.push({
      topology: link._state,
      patch: { targetSlot: slot }
    })
  }
  useLinkStore().updateEndpoints(graph.rootGraph.id, updates)
}
