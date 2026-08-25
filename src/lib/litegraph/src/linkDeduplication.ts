import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { EndpointUpdate } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import cloneDeep from 'es-toolkit/compat/cloneDeep'
import type { LGraph } from './LGraph'
import type { LinkId, LLink, SerialisedLLinkArray } from './LLink'
import type {
  ExportedSubgraph,
  ISerialisedGraph,
  ISerialisedNode,
  SerialisableGraph,
  SerialisableLLink
} from './types/serialisation'
import { NodeSlotType } from './types/globalEnums'

type ConfiguredGraph = (ISerialisedGraph | SerialisableGraph) &
  Partial<Pick<ExportedSubgraph, 'inputs' | 'outputs' | 'reroutes'>>

type ConfiguredLink = SerialisedLLinkArray | SerialisableLLink

function linkFields(link: ConfiguredLink) {
  if (!Array.isArray(link)) return link
  const [id, origin_id, origin_slot, target_id, target_slot] = link
  return { id, origin_id, origin_slot, target_id, target_slot }
}

export function remapLinkReferences(
  data: ConfiguredGraph,
  remapped: ReadonlyMap<number, number>
): void {
  const remap = (id: number) => remapped.get(id) ?? id
  const nodes = data.nodes ?? []

  for (const input of nodes.flatMap((node) => node.inputs ?? [])) {
    if (input.link != null) input.link = remap(input.link)
  }

  const linkIdLists = [
    ...nodes.flatMap((node) =>
      (node.outputs ?? []).map((output) => output.links)
    ),
    ...(data.inputs ?? []).map((slot) => slot.linkIds),
    ...(data.outputs ?? []).map((slot) => slot.linkIds),
    ...(data.reroutes ?? []).map((reroute) => reroute.linkIds)
  ]
  for (const ids of linkIdLists) {
    if (ids) ids.splice(0, ids.length, ...new Set(ids.map(remap)))
  }

  for (const extension of data.extra?.linkExtensions ?? []) {
    extension.id = toLinkId(remap(extension.id))
  }
}

export function normalizeConfiguredTopology<T extends ConfiguredGraph>(
  data: T
): T {
  if (!data.links?.length) return data

  const survivorByTarget = new Map<string, ReturnType<typeof linkFields>>()
  const survivorByDuplicateId = new Map<number, number>()
  const links = data.links.filter((link) => {
    const fields = linkFields(link)
    const key = `${toNodeId(fields.target_id)}:${fields.target_slot}`
    const survivor = survivorByTarget.get(key)
    if (!survivor) {
      survivorByTarget.set(key, fields)
      return true
    }
    if (
      toNodeId(survivor.origin_id) === toNodeId(fields.origin_id) &&
      survivor.origin_slot === fields.origin_slot
    ) {
      survivorByDuplicateId.set(fields.id, survivor.id)
    }
    return false
  })
  if (links.length === data.links.length) return data

  const normalized = Object.assign({}, data, { links })
  if (!survivorByDuplicateId.size) return normalized

  const cloned = cloneDeep(normalized)
  remapLinkReferences(cloned, survivorByDuplicateId)
  return cloned
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
 * Re-points each link's `target_slot` at the configured input with the same
 * name as the serialized input that references it. Replays moved connections
 * because dynamic inputs may grow additional named slots in response.
 *
 * @param graph The graph whose links to realign
 * @param nodesData The serialized node data the graph's nodes were configured
 * from
 */
export function realignInputLinkSlots(
  graph: LGraph,
  nodesData: Iterable<ISerialisedNode>
): void {
  for (const nodeData of nodesData) {
    const node = graph.getNodeById(toNodeId(nodeData.id))
    if (!node) continue

    const referencedNames = new Map<LLink, string[]>()
    for (const input of nodeData.inputs ?? []) {
      if (input.link == null) continue
      const link = graph.links.get(toLinkId(input.link))
      if (!link || link.target_id !== toNodeId(nodeData.id)) continue
      const names = referencedNames.get(link) ?? []
      names.push(input.name)
      referencedNames.set(link, names)
    }

    for (let pass = 0; pass < referencedNames.size; pass++) {
      const moved: { link: LLink; slot: number }[] = []
      for (const [link, names] of referencedNames) {
        const slots = node.inputs.flatMap((input, slot) =>
          names.includes(input.name) ? [slot] : []
        )
        if (!slots.length) continue
        const slot = slots.includes(link.target_slot)
          ? link.target_slot
          : slots[0]
        if (link.target_slot !== slot) moved.push({ link, slot })
      }
      if (!moved.length) break

      const updates: EndpointUpdate[] = moved.map(({ link, slot }) => ({
        topology: link._state,
        patch: { targetSlot: slot }
      }))
      const result = useLinkStore().updateEndpoints(
        graphScopeOf(graph),
        updates
      )
      if (!result.ok) {
        console.error('Failed to realign input link slots', result.error)
        break
      }
      for (const { link, slot } of moved) {
        node.onConnectionsChange?.(
          NodeSlotType.INPUT,
          slot,
          true,
          link,
          node.inputs[slot]
        )
      }
    }
  }
}
