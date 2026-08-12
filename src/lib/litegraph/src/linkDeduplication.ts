import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { EndpointUpdate } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { LGraph } from './LGraph'
import type { LLink, LinkId } from './LLink'
import type { ISerialisedNode } from './types/serialisation'

/**
 * Removes serialized link ids from a node's slots, returning the id each input
 * referenced keyed by input name. Node `configure()` resolves those ids against
 * the destination graph's link map, which may hold unrelated links with the
 * same numeric ids.
 */
export function detachSerialisedLinks(
  nodeData: ISerialisedNode
): Map<string, LinkId> {
  const linkByInputName = new Map<string, LinkId>()
  for (const input of nodeData.inputs ?? []) {
    if (input.link != null)
      linkByInputName.set(input.name, toLinkId(input.link))
    input.link = null
  }
  for (const output of nodeData.outputs ?? []) output.links = []
  return linkByInputName
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
 * @param survivorByRejected Maps a rejected duplicate link id to the existing
 * link kept in its place, so an input referencing a rejected alias realigns
 * the registered link
 */
export function realignInputLinkSlots(
  graph: LGraph,
  nodesData: Iterable<ISerialisedNode>,
  survivorByRejected: ReadonlyMap<LinkId, LinkId> = new Map()
): void {
  const referencedSlots = new Map<LLink, number[]>()

  for (const nodeData of nodesData) {
    for (const [slot, input] of (nodeData.inputs ?? []).entries()) {
      if (input.link == null) continue
      const serializedId = toLinkId(input.link)
      const linkId = survivorByRejected.get(serializedId) ?? serializedId
      const link = graph.links.get(linkId)
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
  const result = useLinkStore().updateEndpoints(graphScopeOf(graph), updates)
  if (!result.ok) {
    console.error('Failed to realign input link slots', result.error)
  }
}
