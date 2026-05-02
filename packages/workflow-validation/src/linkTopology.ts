import type {
  SerialisedGraph,
  SerialisedLinkArray,
  SerialisedLinkObject,
  SerialisedNode
} from './serialised'

export interface LinkContext {
  linkId: number
  originId: string | number
  originSlot: number
  targetId: string | number
  targetSlot: number
}

export type TopologyError =
  | { kind: 'missing-origin-node'; link: LinkContext }
  | { kind: 'missing-target-node'; link: LinkContext }
  | {
      kind: 'origin-slot-out-of-bounds'
      link: LinkContext
      originSlotCount: number
    }
  | {
      kind: 'target-slot-out-of-bounds'
      link: LinkContext
      targetSlotCount: number
    }
  | { kind: 'origin-link-not-listed'; link: LinkContext }
  | {
      kind: 'target-link-mismatch'
      link: LinkContext
      actualLink: number | null
    }

export function describeTopologyError(error: TopologyError): string {
  const { linkId, originId, originSlot, targetId, targetSlot } = error.link
  const tuple = `[link=${linkId} src=${originId}:${originSlot} tgt=${targetId}:${targetSlot}]`
  switch (error.kind) {
    case 'missing-origin-node':
      return `${tuple} origin node ${originId} does not exist in graph`
    case 'missing-target-node':
      return `${tuple} target node ${targetId} does not exist in graph`
    case 'origin-slot-out-of-bounds':
      return `${tuple} origin slot ${originSlot} is out of bounds; node ${originId} has ${error.originSlotCount} output slot(s)`
    case 'target-slot-out-of-bounds':
      return `${tuple} target slot ${targetSlot} is out of bounds; node ${targetId} has ${error.targetSlotCount} input slot(s)`
    case 'origin-link-not-listed':
      return `${tuple} link is not listed in node ${originId}.outputs[${originSlot}].links`
    case 'target-link-mismatch':
      return `${tuple} node ${targetId}.inputs[${targetSlot}].link is ${error.actualLink}, expected ${linkId}`
  }
}

function isLinkObject(
  l: SerialisedLinkArray | SerialisedLinkObject
): l is SerialisedLinkObject {
  return !Array.isArray(l) && typeof l === 'object'
}

export function toLinkContext(
  l: SerialisedLinkArray | SerialisedLinkObject
): LinkContext {
  if (isLinkObject(l)) {
    return {
      linkId: l.id,
      originId: l.origin_id,
      originSlot: l.origin_slot,
      targetId: l.target_id,
      targetSlot: l.target_slot
    }
  }
  return {
    linkId: l[0],
    originId: l[1],
    originSlot: l[2],
    targetId: l[3],
    targetSlot: l[4]
  }
}

function getNodeById(
  graph: SerialisedGraph,
  id: string | number
): SerialisedNode | undefined {
  return graph.nodes.find((n) => n.id == id)
}

function iterateLinks(
  graph: SerialisedGraph
): Array<SerialisedLinkArray | SerialisedLinkObject> {
  if (Array.isArray(graph.links)) {
    return graph.links.filter(
      (l): l is SerialisedLinkArray | SerialisedLinkObject => l != null
    )
  }
  const result: Array<SerialisedLinkArray | SerialisedLinkObject> = []
  for (const l of Object.values(graph.links)) {
    if (l) result.push(l as SerialisedLinkObject)
  }
  return result
}

/**
 * Pure topology check: every link must reference real nodes, in-bounds
 * slots, and consistent input/output endpoints. Does not mutate the
 * graph. Use `repairLinks` (separate module) to attempt auto-fix.
 */
export function validateLinkTopology(graph: SerialisedGraph): TopologyError[] {
  const errors: TopologyError[] = []
  for (const l of iterateLinks(graph)) {
    const link = toLinkContext(l)
    const origin = getNodeById(graph, link.originId)
    const target = getNodeById(graph, link.targetId)

    if (!origin) errors.push({ kind: 'missing-origin-node', link })
    if (!target) errors.push({ kind: 'missing-target-node', link })
    if (!origin || !target) continue

    const outputs = origin.outputs ?? []
    if (link.originSlot < 0 || link.originSlot >= outputs.length) {
      errors.push({
        kind: 'origin-slot-out-of-bounds',
        link,
        originSlotCount: outputs.length
      })
      continue
    }
    const inputs = target.inputs ?? []
    if (link.targetSlot < 0 || link.targetSlot >= inputs.length) {
      errors.push({
        kind: 'target-slot-out-of-bounds',
        link,
        targetSlotCount: inputs.length
      })
      continue
    }

    const originLinks = outputs[link.originSlot]?.links ?? []
    if (!originLinks.includes(link.linkId)) {
      errors.push({ kind: 'origin-link-not-listed', link })
    }
    const targetLink = inputs[link.targetSlot]?.link ?? null
    if (targetLink !== link.linkId) {
      errors.push({
        kind: 'target-link-mismatch',
        link,
        actualLink: targetLink
      })
    }
  }
  return errors
}
