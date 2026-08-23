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

/**
 * Removes serialized link ids from every list and scalar that names them.
 * Used for links dropped because a *different* connection already owns the
 * target slot: remapping would hand the loser's origin a link it does not own,
 * so the reference must be deleted rather than repointed.
 */
function pruneLinkReferences(
  data: ConfiguredGraph,
  dropped: ReadonlySet<number>
): void {
  if (!dropped.size) return
  const nodes = data.nodes ?? []

  for (const input of nodes.flatMap((node) => node.inputs ?? [])) {
    if (input.link != null && dropped.has(input.link)) input.link = null
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
    if (!ids) continue
    const kept = ids.filter((id) => !dropped.has(id))
    if (kept.length !== ids.length) ids.splice(0, ids.length, ...kept)
  }

  if (data.extra?.linkExtensions) {
    data.extra.linkExtensions = data.extra.linkExtensions.filter(
      (extension) => !dropped.has(extension.id)
    )
  }
}

/**
 * Maps each `target_id:target_slot` to the link id the *target side* of the
 * serialized data names, when that side can name exactly one.
 *
 * Positional, not membership. A node input holds a single scalar at a known
 * index, so it is authoritative. A subgraph boundary slot holds an *array*
 * (`SubgraphIO.linkIds`), and a file with two links into one boundary slot
 * lists both ids, so containment cannot discriminate between them - such
 * slots deliberately produce no entry here and fall back to document order.
 */
function authoritativeSurvivorByTarget(
  data: ConfiguredGraph
): Map<string, number> {
  const authoritative = new Map<string, number>()
  for (const node of data.nodes ?? []) {
    const inputs = node.inputs ?? []
    for (const [slot, input] of inputs.entries()) {
      if (input?.link == null) continue
      authoritative.set(`${toNodeId(node.id)}:${slot}`, input.link)
    }
  }
  return authoritative
}

export function normalizeConfiguredTopology<T extends ConfiguredGraph>(
  data: T
): T {
  if (!data.links?.length) return data

  const authoritative = authoritativeSurvivorByTarget(data)

  // Pass 1: group every link by the slot it targets, in document order.
  const byTarget = new Map<string, ReturnType<typeof linkFields>[]>()
  for (const link of data.links) {
    const fields = linkFields(link)
    const key = `${toNodeId(fields.target_id)}:${fields.target_slot}`
    const group = byTarget.get(key)
    if (group) group.push(fields)
    else byTarget.set(key, [fields])
  }

  // Pass 2: pick the survivor per slot. The target side wins when it names a
  // link that is actually in the group; otherwise keep document order.
  const survivorIdByKey = new Map<string, number>()
  const remapped = new Map<number, number>()
  const dropped = new Set<number>()
  for (const [key, group] of byTarget) {
    if (group.length === 1) continue
    const named = authoritative.get(key)
    const survivor =
      (named == null
        ? undefined
        : group.find((fields) => fields.id === named)) ?? group[0]
    survivorIdByKey.set(key, survivor.id)
    for (const fields of group) {
      if (fields.id === survivor.id) continue
      if (
        toNodeId(survivor.origin_id) === toNodeId(fields.origin_id) &&
        survivor.origin_slot === fields.origin_slot
      ) {
        remapped.set(fields.id, survivor.id)
      } else {
        dropped.add(fields.id)
        console.warn(
          `LiteGraph: link ${fields.id} (origin ${String(fields.origin_id)}:${fields.origin_slot}) dropped; ` +
            `${key} is already connected by link ${survivor.id} (origin ${String(survivor.origin_id)}:${survivor.origin_slot})`
        )
      }
    }
  }

  if (!remapped.size && !dropped.size) return data

  const links = data.links.filter((link) => {
    const { id } = linkFields(link)
    return !remapped.has(id) && !dropped.has(id)
  })

  const cloned = cloneDeep(Object.assign({}, data, { links }))
  if (remapped.size) remapLinkReferences(cloned, remapped)
  pruneLinkReferences(cloned, dropped)
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
