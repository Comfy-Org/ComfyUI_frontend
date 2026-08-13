import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { EndpointUpdate } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { LGraph } from './LGraph'
import type { LinkId, LLink, SerialisedLLinkArray } from './LLink'
import type {
  ExportedSubgraph,
  ISerialisedGraph,
  ISerialisedNode,
  SerialisableGraph,
  SerialisableLLink
} from './types/serialisation'

type ConfiguredGraph = (ISerialisedGraph | SerialisableGraph) &
  Partial<Pick<ExportedSubgraph, 'inputs' | 'outputs'>>

type ConfiguredLink = SerialisedLLinkArray | SerialisableLLink

function linkFields(link: ConfiguredLink) {
  return Array.isArray(link)
    ? {
        id: link[0],
        originId: link[1],
        originSlot: link[2],
        targetId: link[3],
        targetSlot: link[4]
      }
    : {
        id: link.id,
        originId: link.origin_id,
        originSlot: link.origin_slot,
        targetId: link.target_id,
        targetSlot: link.target_slot
      }
}

export function normalizeConfiguredTopology<T extends ConfiguredGraph>(
  data: T
): T {
  if (!data.links?.length) return data

  const byTarget = new Map<string, ReturnType<typeof linkFields>>()
  const aliases = new Map<number, number>()
  const links = data.links.filter((link) => {
    const fields = linkFields(link)
    const key = `${String(fields.targetId)}:${fields.targetSlot}`
    const survivor = byTarget.get(key)
    if (!survivor) {
      byTarget.set(key, fields)
      return true
    }
    if (
      toNodeId(survivor.originId) === toNodeId(fields.originId) &&
      survivor.originSlot === fields.originSlot
    ) {
      aliases.set(fields.id, survivor.id)
    }
    return false
  })
  if (links.length === data.links.length) return data
  if (!aliases.size) return Object.assign({}, data, { links })

  const normalized = Object.assign({}, data, {
    links,
    inputs: data.inputs?.map((slot) => ({ ...slot })),
    outputs: data.outputs?.map((slot) => ({ ...slot })),
    nodes: data.nodes?.map((node) => ({
      ...node,
      inputs: node.inputs?.map((input) => ({ ...input })),
      outputs: node.outputs?.map((output) => ({ ...output }))
    }))
  })
  const remap = (id: number) => aliases.get(id) ?? id
  const remapAll = (ids: number[]) => [...new Set(ids.map(remap))]

  for (const slot of [
    ...(normalized.inputs ?? []),
    ...(normalized.outputs ?? [])
  ]) {
    if (slot.linkIds) slot.linkIds = remapAll(slot.linkIds)
  }
  for (const node of normalized.nodes ?? []) {
    for (const input of node.inputs ?? []) {
      if (input.link != null) input.link = remap(input.link)
    }
    for (const output of node.outputs ?? []) {
      if (output.links) output.links = remapAll(output.links)
    }
  }
  return normalized
}

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
 */
export function realignInputLinkSlots(
  graph: LGraph,
  nodesData: Iterable<ISerialisedNode>
): void {
  const referencedSlots = new Map<LLink, number[]>()

  for (const nodeData of nodesData) {
    for (const [slot, input] of (nodeData.inputs ?? []).entries()) {
      if (input.link == null) continue
      const link = graph.links.get(toLinkId(input.link))
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
