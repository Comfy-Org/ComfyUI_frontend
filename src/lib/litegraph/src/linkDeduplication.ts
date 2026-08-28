import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { EndpointUpdate } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
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

  const referencedInputLinks = new Set(
    (data.nodes ?? []).flatMap((node) =>
      (node.inputs ?? []).flatMap((input) =>
        input.link == null ? [] : [input.link]
      )
    )
  )
  const survivorIndexByTarget = new Map<string, number>()
  const survivorByDuplicateId = new Map<number, number>()
  const links: ConfiguredLink[] = []
  for (const link of data.links) {
    const fields = linkFields(link)
    const key = `${toNodeId(fields.target_id)}:${fields.target_slot}`
    const survivorIndex = survivorIndexByTarget.get(key)
    if (survivorIndex === undefined) {
      survivorIndexByTarget.set(key, links.length)
      links.push(link)
      continue
    }
    const survivor = linkFields(links[survivorIndex])
    const isExactDuplicate =
      toNodeId(survivor.origin_id) === toNodeId(fields.origin_id) &&
      survivor.origin_slot === fields.origin_slot
    if (!isExactDuplicate) {
      console.warn(
        `Dropping competing link to occupied input ${fields.target_id}:${fields.target_slot}`,
        {
          droppedLinkId: fields.id,
          survivorLinkId: survivor.id,
          targetNodeId: fields.target_id,
          targetSlot: fields.target_slot
        }
      )
    }

    if (
      !isExactDuplicate &&
      referencedInputLinks.has(fields.id) &&
      !referencedInputLinks.has(survivor.id)
    ) {
      links[survivorIndex] = link
      for (const [id, survivorId] of survivorByDuplicateId) {
        if (survivorId === survivor.id) survivorByDuplicateId.set(id, fields.id)
      }
      survivorByDuplicateId.set(survivor.id, fields.id)
    } else {
      survivorByDuplicateId.set(fields.id, survivor.id)
    }
  }
  if (links.length === data.links.length) return data

  const normalized = Object.assign({}, data, { links })
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
 * @param nodesData The final node id paired with the serialized data that
 * configured it
 */
export function realignInputLinkSlots(
  graph: LGraph,
  nodesData: Iterable<readonly [NodeId, ISerialisedNode]>
): void {
  for (const [nodeId, nodeData] of nodesData) {
    const node = graph.getNodeById(nodeId)
    if (!node) continue

    const referencedNames = new Map<LLink, string[]>()
    for (const input of nodeData.inputs ?? []) {
      if (input.link == null) continue
      const link = graph.links.get(toLinkId(input.link))
      if (!link || link.target_id !== nodeId) continue
      const names = referencedNames.get(link) ?? []
      names.push(input.name)
      referencedNames.set(link, names)
    }

    for (let pass = 0; pass < Math.max(1, referencedNames.size); pass++) {
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

      const unmatched = [...referencedNames].flatMap(([link, names]) =>
        node.inputs.some((input) => names.includes(input.name)) ? [] : [link]
      )
      const destinationSlots = new Set(moved.map(({ slot }) => slot))
      const removals = unmatched.filter(
        (link) =>
          graph.links.has(link.id) && destinationSlots.has(link.target_slot)
      )

      const updates: EndpointUpdate[] = moved.map(({ link, slot }) => ({
        topology: link._state,
        patch: { targetSlot: slot }
      }))
      const removedConnections = removals.map((link) => ({
        connection: link.resolve(graph),
        link
      }))
      const result = useLinkStore().updateEndpoints(
        graphScopeOf(graph),
        updates,
        removals.map((link) => link._state)
      )
      if (!result.ok) {
        console.error('Failed to realign input link slots', result.error)
        break
      }

      for (const { connection, link } of removedConnections) {
        link.disconnect(graph)
        graph.incrementVersion()
        if (connection.inputNode && connection.input) {
          try {
            connection.inputNode.onConnectionsChange?.(
              NodeSlotType.INPUT,
              link.target_slot,
              false,
              link,
              connection.input
            )
          } catch (error) {
            console.error(
              `Failed to notify disconnected link ${link.id}`,
              error
            )
          }
        }
        if (connection.outputNode && connection.output) {
          try {
            connection.outputNode.onConnectionsChange?.(
              NodeSlotType.OUTPUT,
              link.origin_slot,
              false,
              link,
              connection.output
            )
          } catch (error) {
            console.error(
              `Failed to notify disconnected link ${link.id}`,
              error
            )
          }
        }
      }
      for (const { link, slot } of moved) {
        try {
          node.onConnectionsChange?.(
            NodeSlotType.INPUT,
            slot,
            true,
            link,
            node.inputs[slot]
          )
        } catch (error) {
          console.error(`Failed to notify realigned link ${link.id}`, error)
        }
      }
    }
  }
}
