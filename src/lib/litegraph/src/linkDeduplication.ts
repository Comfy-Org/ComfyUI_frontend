import type { LGraphNode, NodeId } from './LGraphNode'
import type { LLink, LinkId } from './LLink'

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
  if (!node) return ids[0]

  for (const input of node.inputs ?? []) {
    if (!input) continue
    const match = ids.find((id) => input.link === id)
    if (match != null) return match
  }
  return ids[0]
}

/** Removes duplicate links from origin outputs and the graph's link map. */
export function purgeOrphanedLinks(
  ids: LinkId[],
  keepId: LinkId,
  links: Map<LinkId, LLink>,
  getNodeById: (id: NodeId) => LGraphNode | null
): void {
  for (const id of ids) {
    if (id === keepId) continue

    const link = links.get(id)
    if (!link) continue

    const originNode = getNodeById(link.origin_id)
    const output = originNode?.outputs?.[link.origin_slot]
    if (output?.links) {
      const idx = output.links.indexOf(id)
      if (idx !== -1) output.links.splice(idx, 1)
    }

    links.delete(id)
  }
}

/** Ensures input.link on the target node points to the surviving link. */
export function repairInputLinks(
  ids: LinkId[],
  keepId: LinkId,
  node: LGraphNode | null
): void {
  if (!node) return

  for (const input of node.inputs ?? []) {
    if (!input?.link || input.link === keepId) continue
    if (ids.includes(input.link)) {
      input.link = keepId
    }
  }
}
